/* maper.chess — Firebase Auth + Firestore
   v2: один Google-аккаунт = один прогресс на всех устройствах.

   Что исправлено:
   1) Перенос прогресса при входе через Google сливает ТРИ источника
      (локальный стейт, старый anonymous-документ, существующий Google-документ)
      и берёт самый свежий по (xp, updatedAt). Раньше облако затиралось локальным.
   2) Устаревшие _pull не могут перезаписать UI и облако (защита seq/epoch).
   3) flush() не затирает более новое облако (проверка updatedAt).
   4) Операции сериализованы — нет гонок между pull / adopt / flush. */

const Cloud = {
  enabled: false,
  user: null,
  _db: null,
  _auth: null,
  _timer: null,
  _ready: false,
  onChange: null,
  _serverDayCache: null,
  authError: null,

  _pullSeq: 0,        // номер последнего запущенного _pull
  _adoptEpoch: 0,     // эпоха переноса прогресса: pull старой эпохи не эмитит loaded
  _cloudUpdatedAt: 0, // updatedAt последнего известного облачного снапшота
  _chain: Promise.resolve(),

  init(onChange) {
    this.onChange = onChange;

    try {
      if (
        typeof firebase === "undefined" ||
        !FIREBASE_CONFIG ||
        !FIREBASE_CONFIG.apiKey
      ) {
        console.error("Firebase SDK/config not found");

        this.authError = {
          code: "firebase-not-configured",
          message: "Firebase SDK или конфигурация не найдены"
        };

        return this._emit({
          error: true,
          code: "firebase-not-configured"
        });
      }

      /* Инициализируем Firebase только один раз. */
      if (!firebase.apps.length) {
        firebase.initializeApp(FIREBASE_CONFIG);
      }

      if (typeof firebase.analytics
 === "function") {
  try {
    this.analytics
 = firebase.analytics
();

    this.analytics.logEvent("page_view");

    // Отслеживаем клики по элементам сайта
    if (!this._analyticsClicksEnabled) {
      this._analyticsClicksEnabled = true;

      document.addEventListener("click", (event) => {
        const element = event.target.closest(
          "button, a, [role='button']"
        );

        if (!element || !this.analytics
) return;

        const label = (
          element.innerText ||
          element.getAttribute("aria-label") ||
          element.id
 ||
          element.getAttribute("href") ||
          "без названия"
        ).trim().slice(0, 100);

        this.analytics.logEvent("site_click", {
          element_text: label
        });
      });
    }

    console.log("Google Analytics подключён");
  } catch (e) {
    console.warn("Ошибка Google Analytics:", e);
  }
}

      this._auth = firebase.auth();
      this._db = firebase.firestore();
      this.enabled = true;

      /* Сохраняем сессию локально, чтобы на ПК/телефоне
         вход в тот же Google-аккаунт восстанавливался автоматически. */
      this._auth
        .setPersistence(
          firebase.auth.Auth.Persistence.LOCAL
        )
        .catch(e => {
          console.warn(
            "Firebase persistence failed:",
            e
          );
        });

      /* Следим за Firebase Auth. Операции сериализованы,
         чтобы auth-события не пересекались с переносом прогресса. */
      this._auth.onAuthStateChanged(user => {
        this._serialize(async () => {
          this._ready = false;

          if (!user) {
            this.user = null;

            console.warn(
              "Firebase: пользователь не авторизован"
            );

            try {
              console.log(
                "Firebase: запускаю Anonymous sign-in..."
              );

              const result =
                await this._auth.signInAnonymously();

              console.log(
                "Firebase Anonymous login OK:",
                result.user.uid
              );
            } catch (e) {
              this.authError = {
                code: e.code || "auth-error",
                message:
                  e.message ||
                  String(e)
              };

              console.error(
                "Firebase Anonymous sign-in FAILED",
                e
              );

              this._emit({
                error: true,
                code: e.code || "auth-error",
                message: e.message || String(e)
              });
            }

            return;
          }

          /* Пользователь Firebase существует. */
          this.user = user;
          this.authError = null;

          console.log(
            "Firebase Auth OK",
            {
              uid: user.uid,
              anonymous: user.isAnonymous,
              email: user.email || null
            }
          );

          this._emit({
            authenticated: true,
            uid: user.uid,
            anonymous: user.isAnonymous
          });

          await this._pull();
        });
      });

    } catch (e) {
      console.error(
        "Firebase Cloud.init FAILED",
        e
      );

      this.enabled = false;

      this.authError = {
        code: e.code || "init-error",
        message: e.message || String(e)
      };

      this._emit({
        error: true,
        code: e.code || "init-error",
        message: e.message || String(e)
      });
    }
  },

  /* Сериализация всех асинхронных операций облака. */
  _serialize(fn) {
    this._chain = this._chain
      .then(fn)
      .catch(e =>
        console.warn("Cloud op failed:", e)
      );

    return this._chain;
  },

  _emit(extra) {
    if (this.onChange) {
      this.onChange(
        Object.assign(
          {
            enabled: this.enabled,
            user: this.user,
            authenticated: !!this.user,
            authError: this.authError
          },
          extra || {}
        )
      );
    }
  },

  async serverDay() {
    if (
      !this.enabled ||
      !this.user ||
      !this._ready
    ) {
      return null;
    }

    const now = Date.now();

    if (
      this._serverDayCache &&
      now - this._serverDayCache.at <
        5 * 60000
    ) {
      return this._serverDayCache.day;
    }

    try {
      const ref = this._db
        .collection("users")
        .doc(this.user.uid)
        .collection("meta")
        .doc("time");

      await ref.set({
        ping:
          firebase.firestore.FieldValue.serverTimestamp()
      });

      const snap = await ref.get();

      const ts =
        snap.data() &&
        snap.data().ping;

      if (!ts) return null;

      const day = dayKey(ts.toDate());
      const at = Date.now();

      /* skew = насколько часы устройства опережают сервер (мс); <=0 — не опережают */
      this._serverDayCache = {
        day,
        at: now,
        skew: at - ts.toMillis()
      };

      return day;

    } catch (e) {
      console.warn(
        "serverDay failed:",
        e
      );

      return null;
    }
  },

  /*
   * Перенос прогресса со старого (anonymous) аккаунта на Google-аккаунт.
   *
   * КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: сливаем ВСЕ ТРИ источника —
   *   1) локальный снапшот (снят ДО смены сессии),
   *   2) документ старого anonymous-пользователя,
   *   3) существующий документ Google-пользователя (прогресс с телефона!)
   * — и выбираем самый свежий по (xp, updatedAt).
   * Раньше п.3 игнорировался, и локальный стейт ПК затирал прогресс телефона.
   */
  async _adoptFrom(prevUid, localSnapshot) {
    const u = this._auth.currentUser;

    if (
      !prevUid ||
      !u ||
      prevUid === u.uid
    ) {
      return;
    }

    try {
      const db = this._db;

      const uOld = db
        .collection("users")
        .doc(prevUid);

      const uNew = db
        .collection("users")
        .doc(u.uid);

      const lOld = db
        .collection("leaderboard")
        .doc(prevUid);

      const lNew = db
        .collection("leaderboard")
        .doc(u.uid);

      const [us, ls, ns] =
        await Promise.all([
          uOld.get(),
          lOld.get(),
          uNew.get()
        ]);

      /* Собираем все копии прогресса */
      const candidates = [];

      if (localSnapshot) {
        candidates.push(localSnapshot);
      }

      if (us.exists) {
        try {
          candidates.push(
            JSON.parse(us.data().data)
          );
        } catch (_) {}
      }

      if (ns.exists) {
        try {
          candidates.push(
            JSON.parse(ns.data().data)
          );
        } catch (_) {}
      }

      if (!candidates.length) {
        return;
      }

      /* Самый свежий прогресс: сначала XP, при равенстве — updatedAt */
      let chosen = candidates[0];

      for (let i = 1; i < candidates.length; i++) {
        const c = candidates[i];

        if (
          c.xp > chosen.xp ||
          (
            c.xp === chosen.xp &&
            (c.updatedAt || 0) >
            (chosen.updatedAt || 0)
          )
        ) {
          chosen = c;
        }
      }

      chosen = Object.assign({}, chosen);

      /* Огонёк сливаем отдельно от всех копий — не теряем более свежий */
      let mergedStreak =
        mergeStreak(candidates[0].streak);

      for (let i = 1; i < candidates.length; i++) {
        mergedStreak = mergeStreaks(
          mergedStreak,
          candidates[i].streak
        );
      }

      chosen.streak = mergedStreak;

      /* ежедневное испытание — тоже сливаем со всех копий */
      if (typeof mergeDailies === "function") {
        let md = mergeDaily(candidates[0].daily);
        for (let i = 1; i < candidates.length; i++) md = mergeDailies(md, candidates[i].daily);
        chosen.daily = md;
      }

      const batch = db.batch();

      batch.set(
        uNew,
        {
          data: JSON.stringify(chosen),
          xp: chosen.xp,
          updatedAt:
            chosen.updatedAt ||
            Date.now(),
          nick:
            chosen.nick ||
            null,
          email:
            u.email ||
            null,
          anonymous: false
        }
      );

      /*
       * Leaderboard: не затираем существующую строку Google-аккаунта,
       * если в ней не меньше опыта. Иначе переносим со старого аккаунта.
       */
      const oldXp =
        ls.exists
          ? (ls.data().xp || 0)
          : -1;

      const newXp =
        ns.exists
          ? (ns.data().xp || 0)
          : -1;

      if (ls.exists && oldXp >= newXp) {
        batch.set(
          lNew,
          Object.assign(
            {},
            ls.data(),
            {
              updatedAt: Date.now()
            }
          )
        );
      }

      await batch.commit();

      this._cloudUpdatedAt =
        chosen.updatedAt || Date.now();

      /* Удаляем старые документы anonymous-пользователя.
         Строго по очереди: сначала рейтинг, потом профиль — правила Firestore проверяют
         по профилю гостя, что строку рейтинга можно удалять. */
      if (ls.exists) {
        try { await lOld.delete(); }
        catch (e) { console.warn("old leaderboard doc:", e.code || e); }
      }

      if (us.exists) {
        try { await uOld.delete(); } catch (e) {}
      }

      console.log(
        "adoptFrom: прогресс перенесён",
        {
          from: prevUid,
          to: u.uid,
          xp: chosen.xp
        }
      );

    } catch (e) {
      console.error(
        "adoptFrom failed:",
        e
      );
    } finally {
      /*
       * Завершаем эпоху переноса и делаем финальный pull —
       * именно он (самый свежий) эмитит loaded в UI.
       */
      this._adoptEpoch++;
      await this._pull();
    }
  },

  async signIn() {
    if (!this._auth) {
      console.warn(
        "Firebase Auth is not initialized"
      );
      return;
    }

    const p =
      new firebase.auth.GoogleAuthProvider();

    const prevUid =
      this.user &&
      this.user.isAnonymous
        ? this.user.uid
        : null;

    /*
     * Снимок локального прогресса ДО смены сессии.
     * После signInWithCredential UI.state может быть уже перезаписан,
     * поэтому опираемся только на этот снапшот.
     */
    const localSnapshot =
      typeof UI !== "undefined" &&
      UI.state
        ? JSON.parse(
            JSON.stringify(UI.state)
          )
        : null;

    try {
      if (
        this.user &&
        this.user.isAnonymous
      ) {
        try {
          /* Первичная привязка Google к anonymous-аккаунту */
          await this.user.linkWithPopup(p);

          /* uid при link не меняется — просто перечитываем облако */
          this.user =
            this._auth.currentUser;

          this._adoptEpoch++;
          this._cloudUpdatedAt = 0;

          await this._pull();

          return;

        } catch (e) {
          if (
            e.code ===
              "auth/credential-already-in-use" &&
            e.credential
          ) {
            /*
             * Google уже привязан (например, на телефоне).
             * Входим в тот же аккаунт и переносим прогресс.
             * Эпоху бUMP-им ДО смены сессии: pull, вызванный
             * сменой auth, устареет и не зальёт локальный стейт
             * поверх облачного.
             */
            this._adoptEpoch++;

            await this._auth
              .signInWithCredential(
                e.credential
              );

            await this._adoptFrom(
              prevUid,
              localSnapshot
            );

            return;
          }

          throw e;
        }
      }

      await this._auth
        .signInWithPopup(p);

    } catch (e) {
      console.error(
        "Google sign-in failed:",
        e
      );

      if (
        [
          "auth/popup-blocked",
          "auth/operation-not-supported-in-this-environment"
        ].includes(e.code)
      ) {
        return this._auth
          .signInWithRedirect(p);
      }

      if (
        ![
          "auth/popup-closed-by-user",
          "auth/cancelled-popup-request"
        ].includes(e.code)
      ) {
        /* возвращаем UI в актуальное состояние */
        this._adoptEpoch++;
        this._pull().catch(() => {});

        this._emit({
          error: true,
          code: e.code,
          message: e.message
        });
      }
    }
  },

  async signOut() {
    clearTimeout(this._timer);

    this._ready = false;
    this._cloudUpdatedAt = 0;

    if (this._auth) {
      await this._auth.signOut();
    }
  },

  async _pull() {
    if (!this.user) {
      console.warn(
        "Cloud._pull called without user"
      );

      return;
    }

    const seq = ++this._pullSeq;
    const epoch = this._adoptEpoch;

    const uid =
      this.user.uid;

    try {
      const snap =
        await this._db
          .collection("users")
          .doc(uid)
          .get();

      const local =
        UI.state;

      const cloud =
        snap.exists
          ? JSON.parse(
              snap.data().data
            )
          : null;

      /* фиксируем «возраст» облака — flush будет его уважать */
      this._cloudUpdatedAt =
        snap.exists
          ? (snap.data().updatedAt || 0)
          : 0;

      let chosen = local;

      if (
        cloud &&
        (
          cloud.xp >
            local.xp ||
          (
            cloud.xp === local.xp &&
            (cloud.updatedAt || 0) >
            (local.updatedAt || 0)
          )
        )
      ) {
        chosen = cloud;
      }

      let pushLocal = chosen === local;

      /* ОГОНЁК: сливаем отдельно от остального прогресса —
         иначе облако целиком затирает локальный стейт,
         и более свежий огонёк (с другого устройства) терялся. */
      if (cloud) {
        const merged = mergeStreaks(local.streak, cloud.streak);
        const cs = JSON.stringify(mergeStreak(cloud.streak));
        chosen = Object.assign({}, chosen, { streak: merged });
        if (JSON.stringify(merged) !== cs) pushLocal = true;

        /* ЕЖЕДНЕВНОЕ ИСПЫТАНИЕ: тоже сливаем по дням, чтобы результат с другого устройства не терялся */
        if (typeof mergeDailies === "function") {
          const md = mergeDailies(local.daily, cloud.daily);
          const cd = JSON.stringify(mergeDaily(cloud.daily));
          chosen = Object.assign({}, chosen, { daily: md });
          if (JSON.stringify(md) !== cd) pushLocal = true;
        }
      }

      this._ready = true;

      /*
       * Защита от устаревших pull: только последний pull
       * в текущей эпохе имеет право менять UI.
       */
      const fresh =
        seq === this._pullSeq &&
        epoch === this._adoptEpoch;

      if (!fresh) {
        return;
      }

      this._emit({
        loaded:
          normalizeState(chosen),
        pushLocal:
          pushLocal
      });

      console.log(
        "Firestore connection OK",
        {
          uid: uid,
          userDocumentExists:
            snap.exists
        }
      );

    } catch (e) {
      if (seq !== this._pullSeq) {
        return;
      }

      console.error(
        "Cloud load failed:",
        e
      );

      this._ready = false;

      this._emit({
        error: true,
        code:
          e.code ||
          "firestore-load",
        message:
          e.message ||
          String(e)
      });
    }
  },

  queueSave(state) {
    if (
      !this.enabled ||
      !this.user ||
      !this._ready
    ) {
      return;
    }

    clearTimeout(
      this._timer
    );

    this._timer =
      setTimeout(
        () => this.flush(state),
        1500
      );
  },

  flush(state) {
    if (
      !this.enabled ||
      !this.user ||
      !this._ready
    ) {
      return Promise.resolve();
    }

    const up =
      state.updatedAt || 0;

    /*
     * Защита: если облако новее локального стейта
     * (например, прогресс с телефона ещё не подтянулся),
     * локальный стейт НЕ заливаем — иначе он затирает облако.
     */
    if (
      this._cloudUpdatedAt &&
      up < this._cloudUpdatedAt
    ) {
      return Promise.resolve();
    }

    return this._db
      .collection("users")
      .doc(this.user.uid)
      .set({
        data:
          JSON.stringify(state),

        xp:
          state.xp,

        updatedAt:
          up ||
          Date.now(),

        nick:
          state.nick ||
          null,

        /* поля для админ-панели (поиск, сортировка, список игроков) */
        nickLower:
          (typeof Nick !== "undefined" && state.nick)
            ? Nick.normKey(state.nick)
            : null,

        coins:
          Math.max(0, Math.floor(+state.coins || 0)),

        createdAt:
          state.createdAt ||
          up ||
          Date.now(),

        lastSeenAt:
          Date.now(),

        email:
          this.user.email ||
          null,

        anonymous:
          !!this.user.isAnonymous

      })
      .then(() => {
        this._cloudUpdatedAt =
          up || Date.now();
      })
      .catch(e => {
        console.error(
          "Cloud save failed:",
          e
        );
      });
  }
};