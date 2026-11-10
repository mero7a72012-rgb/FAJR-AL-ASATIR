
// FAJR AL-ASATIR | WEBSITE DATA ENGINE
// ==========================================

const SUPABASE_URL = "https://tkjpfvxchjxuazgtkskw.supabase.co";
const SUPABASE_KEY = "sb_publishable_kWg905MOatFUc4HuScPaTA_8DJAGdtp";

if (!window.supabase) {
  throw new Error("مكتبة Supabase لم يتم تحميلها قبل script.js");
}

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
// HELPERS
// ==========================================

const $ = (id) => document.getElementById(id);

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined && text !== null) element.textContent = text;
  return element;
}

function showError(container, message) {
  if (!container) return;
  container.replaceChildren(createElement("p", "empty-message", message));
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("ar-EG", {
    year: "numeric", month: "long", day: "numeric"
  }).format(date);
}

function number(value) {
  return Number(value) || 0;
}

function showAdminMessage(element, message) {
  if (element) element.textContent = message;
}

function createRecordActions() {
  return createElement("div", "admin-record-actions");
}

function showDatabaseError(action, error) {
  console.error(action, error);
  const message = error?.message || error?.details || "خطأ غير معروف";
  alert(`${action}\n${message}`);
}

// ==========================================
// PODIUM HELPERS
// ==========================================

const PODIUM_POSITIONS = [
  { rank: 2, medal: "🥈", label: "المركز الثاني" },
  { rank: 1, medal: "🥇", label: "المركز الأول" },
  { rank: 3, medal: "🥉", label: "المركز الثالث" }
];

function renderPodium(container, records, kind) {
  if (!container) return;
  container.replaceChildren();

  const rankedRecords = PODIUM_POSITIONS
    .map(position => ({ ...position, record: records.find(item => Number(item.rank) === position.rank) }))
    .filter(item => item.record);

  if (!rankedRecords.length) {
    showError(container, kind === "champion"
      ? "لا يوجد أبطال مواسم مسجلون حتى الآن."
      : "لا يوجد نجوم بطولة مسجلون حتى الآن.");
    return;
  }

  const stage = createElement("div", "podium-stage");
  PODIUM_POSITIONS.forEach(position => {
    const record = records.find(item => Number(item.rank) === position.rank);
    if (!record) return;

    const card = createElement("article", `podium-card podium-rank-${position.rank}`);
    const medal = createElement("div", "podium-medal", position.medal);
    const rankLabel = createElement("div", "podium-rank-label", position.label);
    const name = createElement("h4", "podium-name",
      kind === "champion" ? (record.title || "بطل الموسم") : (record.player_name || "نجم البطولة"));
    card.append(rankLabel, medal, name);

    if (kind === "champion") {
      if (record.details) card.appendChild(createElement("p", "podium-details", record.details));
    } else {
      const team = App.state.teams.find(item => String(item.id) === String(record.team_id));
      if (team) card.appendChild(createElement("p", "podium-team", team.name));
      if (record.achievement) card.appendChild(createElement("p", "podium-details", record.achievement));
    }

    stage.appendChild(card);
  });

  container.appendChild(stage);
}

async function clearOtherPodiumSlots(table, rank, keepId) {
  const { error } = await db.from(table)
    .update({ rank: null })
    .eq("rank", rank)
    .neq("id", keepId);
  if (error) throw error;
}

// ==========================================
// APPLICATION
// ==========================================

const App = {
  state: {
    teams: [],
    standings: [],
    matches: [],
    announcements: [],
    champions: [],
    performers: []
  },

  async init() {
    const status = $("connection-status");
    try {
      if (status) status.textContent = "جاري تحميل بيانات البطولة...";
      const result = await this.loadAll();
      if (status && result.errors.length === 0) {
        status.textContent = "تم تحميل بيانات البطولة بنجاح";
      }
      console.log("Fajr Al-Asatir initialization finished.");
    } catch (error) {
      console.error("Application error:", error);
      if (status) status.textContent = "حدث خطأ أثناء تحميل بيانات البطولة: " + (error.message || error);
    }
  },

  async loadAll() {
    const status = $("connection-status");

    const names = [
      "teams",
      "standings",
      "matches",
      "announcements",
      "champions",
      "performers"
    ];

    const requests = await Promise.allSettled([
      db.from("teams").select("*").order("name"),
      db.from("standings").select("*"),
      db.from("matches_public").select("*").order("match_date"),
      db.from("announcements").select("*").order("created_at", { ascending: false }),
      db.from("champions_history").select("*").order("created_at", { ascending: false }),
      db.from("top_performers").select("*").order("created_at", { ascending: false })
    ]);

    const results = {};
    const errors = [];

    requests.forEach((result, index) => {
      const name = names[index];

      if (result.status === "rejected") {
        results[name] = [];
        errors.push(name + ": " + String(result.reason));
        console.error(name + " ERROR:", result.reason);
        return;
      }

      if (result.value.error) {
        results[name] = [];
        errors.push(name + ": " + result.value.error.message);
        console.error(name + " ERROR:", result.value.error);
        return;
      }

      results[name] = result.value.data || [];
      console.log(name + " loaded:", results[name].length);
    });

    this.state.teams = results.teams;
    this.state.standings = results.standings;
    this.state.matches = results.matches;
    this.state.announcements = results.announcements;
    this.state.champions = results.champions;
    this.state.performers = results.performers;

    this.renderAll();
    updateAdminStats();

    if (status && errors.length) {
      status.textContent = "أخطاء تحميل البيانات: " + errors.join(" | ");
    }

    return { errors };
  },

  renderAll() {
    this.renderStandings();
    this.renderMatches();
    this.renderTeams();
    this.renderAnnouncements();
    this.renderChampions();
    this.renderPerformers();

    renderAdminTeams();
    renderAdminAnnouncements();
    renderAdminChampions();
    renderAdminPerformers();
  },

  renderStandings() {
    const body = $("standings-body");
    if (!body) return;
    body.replaceChildren();

    if (!this.state.standings.length) {
      const row = createElement("tr");
      const cell = createElement("td", "", "لا توجد بيانات ترتيب متاحة حاليًا.");
      cell.colSpan = 10;
      row.appendChild(cell);
      body.appendChild(row);
      return;
    }

    this.state.standings.forEach((team, index) => {
      const row = document.createElement("tr");
      const values = [
        index + 1, team.name || team.team_name || "—", team.played,
        team.won ?? team.wins, team.drawn ?? team.draws,
        team.lost ?? team.losses, team.goals_for, team.goals_against,
        team.goal_difference ?? team.goal_diff, team.points
      ];

      values.forEach((value, columnIndex) => {
        const cell = createElement("td", "", value ?? 0);
        if (columnIndex === 1) {
          cell.style.fontWeight = "800";
          cell.style.color = team.color || "#e3b64a";
        }
        if (columnIndex === 9) {
          cell.style.color = "#e3b64a";
          cell.style.fontWeight = "900";
        }
        row.appendChild(cell);
      });
      body.appendChild(row);
    });
  },

  renderTeams() {
    const container = $("teams-list");
    if (!container) return;
    container.replaceChildren();

    if (!this.state.teams.length) {
      showError(container, "لم يتم العثور على الفرق.");
      return;
    }

    this.state.teams.forEach((team) => {
      const stats = this.state.standings.find(
        item => item.id === team.id || item.team_id === team.id
      ) || {};
      const card = createElement("article", "team-card");
      card.style.setProperty("--team-color", team.color || "#e3b64a");

      const title = createElement("h3", "team-name", team.name);
      const english = createElement("p", "team-english", team.english_name || "");
      const leader = createElement("p", "team-leader", "القائد: " + (team.leader || "غير محدد"));
      const members = createElement(
        "p", "team-members",
        "الأعضاء: " + (Array.isArray(team.members) ? team.members.join("، ") : "")
      );
      const statsContainer = createElement("div", "team-stats");

      [["لعب", stats.played], ["فوز", stats.won ?? stats.wins], ["نقاط", stats.points]]
        .forEach(([label, value]) => {
          const item = createElement("div", "team-stat");
          item.append(createElement("strong", "", number(value)), createElement("span", "", label));
          statsContainer.appendChild(item);
        });

      card.append(title, english, leader, members, statsContainer);
      container.appendChild(card);
    });
  },

  renderMatches() {
    const container = $("matches-list");
    if (!container) return;
    container.replaceChildren();

    if (!this.state.matches.length) {
      showError(container, "لا توجد مباريات مسجلة حتى الآن.");
      return;
    }

    this.state.matches.forEach((match) => {
      const card = createElement("article", "match-card");
      const meta = createElement("div", "match-meta");
      meta.append(
        createElement("span", "", match.round_label || "مواجهة البطولة"),
        createElement("span", "", formatDate(match.match_date))
      );

      const teams = createElement("div", "match-teams");
      const teamA = createElement("div", "match-team", match.team_a_name || match.team_a || "الفريق الأول");
      const teamB = createElement("div", "match-team", match.team_b_name || match.team_b || "الفريق الثاني");
      const isFinished = match.status === "finished" ||
        (match.score_a !== null && match.score_b !== null);

      const score = createElement(
        "div", "match-score",
        isFinished ? `${number(match.score_a)} - ${number(match.score_b)}` : "VS"
      );
      teams.append(teamA, score, teamB);
      const status = createElement("div", "match-status", isFinished ? "انتهت المواجهة" : "مواجهة قادمة");
      card.append(meta, teams, status);
      container.appendChild(card);
    });
  },

  renderAnnouncements() {
    const container = $("announcements-list");
    if (!container) return;
    container.replaceChildren();

    if (!this.state.announcements.length) {
      showError(container, "لا توجد إعلانات حاليًا.");
      return;
    }

    this.state.announcements.forEach((announcement) => {
      const card = createElement("article", "announcement-card");
      card.append(
        createElement("h3", "", announcement.title),
        createElement("p", "", announcement.body),
        createElement("div", "announcement-date", formatDate(announcement.created_at))
      );
      container.appendChild(card);
    });
  },

  renderChampions() {
    renderPodium($("champions-list"), this.state.champions, "champion");
  },

  renderPerformers() {
    renderPodium($("performers-list"), this.state.performers, "performer");
  }
};

// ==========================================
// ADMIN ELEMENTS + STARTUP
// ==========================================

const adminOpenButton = $("admin-open");
const adminModal = $("admin-modal");
const adminCloseButton = $("admin-close");
const adminDashboard = $("admin-dashboard");
const adminLogoutButton = $("admin-logout");
const adminLoginForm = $("loginForm");
const adminLoginMessage = $("loginMessage");

document.addEventListener("DOMContentLoaded", () => App.init());

if (adminOpenButton && adminModal) {
  adminOpenButton.addEventListener("click", () => adminModal.classList.add("active"));
}
if (adminCloseButton && adminModal) {
  adminCloseButton.addEventListener("click", () => adminModal.classList.remove("active"));
}
if (adminModal) {
  adminModal.addEventListener("click", event => {
    if (event.target === adminModal) adminModal.classList.remove("active");
  });
}

// ==========================================
// LOGIN / LOGOUT
// ==========================================

if (adminLoginForm) {
  adminLoginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = $("email")?.value.trim();
    const password = $("password")?.value;

    if (!email || !password) {
      showAdminMessage(adminLoginMessage, "أدخل البريد الإلكتروني وكلمة المرور.");
      return;
    }

    showAdminMessage(adminLoginMessage, "جارٍ التحقق من الحساب...");

    try {
      const { error } = await db.auth.signInWithPassword({ email, password });
      if (error) {
        showAdminMessage(adminLoginMessage, "تعذر تسجيل الدخول. راجع البيانات.");
        return;
      }

      const { data: isAdmin, error: adminError } = await db.rpc("is_admin");
      if (adminError || isAdmin !== true) {
        await db.auth.signOut();
        showAdminMessage(adminLoginMessage, "هذا الحساب لا يمتلك صلاحيات الإدارة.");
        return;
      }

      adminModal?.classList.remove("active");
      if (adminDashboard) {
        adminDashboard.classList.add("active");
        adminDashboard.setAttribute("aria-hidden", "false");
      }
      showAdminMessage(adminLoginMessage, "");
      adminLoginForm.reset();
      await App.loadAll();
      console.log("Admin dashboard opened successfully.");
    } catch (error) {
      console.error("Admin login error:", error);
      showAdminMessage(adminLoginMessage, "حدث خطأ غير متوقع. حاول مرة أخرى.");
    }
  });
}

if (adminLogoutButton) {
  adminLogoutButton.addEventListener("click", async () => {
    try {
      const { error } = await db.auth.signOut();
      if (error) throw error;
      if (adminDashboard) {
        adminDashboard.classList.remove("active");
        adminDashboard.setAttribute("aria-hidden", "true");
      }
      console.log("Admin logged out successfully.");
    } catch (error) {
      showDatabaseError("تعذر تسجيل الخروج", error);
    }
  });
}

// ==========================================
// SIDEBAR NAVIGATION
// ==========================================

document.querySelectorAll(".admin-menu-item").forEach((button) => {
  button.addEventListener("click", function () {
    const targetSection = this.getAttribute("data-admin-section");
    document.querySelectorAll(".admin-menu-item").forEach(item => item.classList.remove("active"));
    this.classList.add("active");
    document.querySelectorAll(".admin-view").forEach(view => view.classList.remove("active"));

    const targetView = document.querySelector(`.admin-view[data-admin-view="${targetSection}"]`);
    if (targetView) targetView.classList.add("active");

    switch (targetSection) {
      case "matches": renderAdminMatches(); break;
      case "teams": renderAdminTeams(); break;
      case "announcements": renderAdminAnnouncements(); break;
      case "champions": renderAdminChampions(); break;
      case "performers": renderAdminPerformers(); break;
      case "admins": renderAdminUsers(); break;
    }
  });
});

// ==========================================
// MATCH MANAGEMENT
// ==========================================

const adminMatchForm = $("admin-match-form");
const adminMatchesList = $("admin-matches-list");
const adminMatchMessage = $("match-form-message");

function renderAdminMatches() {
  if (!adminMatchesList) return;
  adminMatchesList.replaceChildren();

  if (!App.state.matches.length) {
    showError(adminMatchesList, "لا توجد مباريات مسجلة حتى الآن.");
    return;
  }

  App.state.matches.forEach((match) => {
    const card = createElement("article", "admin-stat-card");
    card.append(
      createElement("h3", "", `${match.team_a_name || "الفريق الأول"} × ${match.team_b_name || "الفريق الثاني"}`),
      createElement("p", "", match.round_label || "مواجهة البطولة"),
      createElement("p", "", formatDate(match.match_date)),
      createElement(
        "strong", "",
        match.score_a !== null && match.score_b !== null
          ? `${match.score_a} - ${match.score_b}` : "لم تُسجل النتيجة بعد"
      )
    );

    const deleteButton = createElement("button", "admin-delete-match", "حذف المباراة");
    deleteButton.type = "button";
    deleteButton.addEventListener("click", async () => {
      if (!window.confirm("هل أنت متأكد من حذف هذه المباراة؟")) return;
      deleteButton.disabled = true;
      try {
        // يتم الحذف من جدول matches الأساسي، بينما القراءة العامة تتم من matches_public.
        const { error } = await db.from("matches").delete().eq("id", match.id);
        if (error) throw error;
        await App.loadAll();
        alert("تم حذف المباراة بنجاح.");
      } catch (error) {
        showDatabaseError("تعذر حذف المباراة", error);
        deleteButton.disabled = false;
      }
    });

    card.appendChild(deleteButton);
    adminMatchesList.appendChild(card);
  });
}

function updateAdminStats() {
  if ($("admin-team-count")) $("admin-team-count").textContent = App.state.teams.length;
  if ($("admin-match-count")) $("admin-match-count").textContent = App.state.matches.length;
  if ($("admin-announcement-count")) $("admin-announcement-count").textContent = App.state.announcements.length;
  if ($("admin-performer-count")) $("admin-performer-count").textContent = App.state.performers.length;
  renderAdminMatches();
}

if (adminMatchForm) {
  adminMatchForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    showAdminMessage(adminMatchMessage, "جارٍ حفظ المباراة...");

    try {
      const round = $("match-round")?.value.trim() || "";
      const teamAName = $("match-team-a")?.value.trim() || "";
      const teamBName = $("match-team-b")?.value.trim() || "";
      const dateValue = $("match-date")?.value;
      const scoreAValue = $("match-score-a")?.value.trim() || "";
      const scoreBValue = $("match-score-b")?.value.trim() || "";

      const teamA = App.state.teams.find(team =>
        team.name.trim().toLocaleLowerCase() === teamAName.toLocaleLowerCase()
      );
      const teamB = App.state.teams.find(team =>
        team.name.trim().toLocaleLowerCase() === teamBName.toLocaleLowerCase()
      );

      if (!teamA || !teamB) {
        showAdminMessage(adminMatchMessage, "تأكد من كتابة أسماء الفرق المسجلة بشكل صحيح.");
        return;
      }
      if (String(teamA.id) === String(teamB.id)) {
        showAdminMessage(adminMatchMessage, "لا يمكن اختيار الفريق نفسه في طرفي المباراة.");
        return;
      }

      const scoreAEmpty = scoreAValue === "";
      const scoreBEmpty = scoreBValue === "";
      if (scoreAEmpty !== scoreBEmpty) {
        showAdminMessage(adminMatchMessage, "أدخل نتيجة الفريقين معًا أو اترك الخانتين فارغتين.");
        return;
      }

      let scoreA = null;
      let scoreB = null;
      if (!scoreAEmpty) {
        scoreA = Number(scoreAValue);
        scoreB = Number(scoreBValue);
        if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB) || scoreA < 0 || scoreB < 0) {
          showAdminMessage(adminMatchMessage, "أدخل نتيجتين صحيحتين أكبر من أو تساوي صفرًا.");
          return;
        }
      }

      const matchDate = new Date(dateValue);
      if (!dateValue || Number.isNaN(matchDate.getTime())) {
        showAdminMessage(adminMatchMessage, "أدخل موعدًا صحيحًا للمباراة.");
        return;
      }

      const { error } = await db.from("matches").insert({
        team_a: teamA.id, team_b: teamB.id, round_label: round,
        match_date: matchDate.toISOString(), score_a: scoreA, score_b: scoreB
      });
      if (error) throw error;

      showAdminMessage(adminMatchMessage, "تمت إضافة المباراة بنجاح.");
      adminMatchForm.reset();
      await App.loadAll();
    } catch (error) {
      console.error("Add match error:", error);
      showAdminMessage(adminMatchMessage, "تعذر حفظ المباراة: " + (error.message || "راجع البيانات."));
    }
  });
}

// ==========================================
// TEAM MANAGEMENT
// ==========================================

const adminTeamsList = $("admin-teams-list");

function renderAdminTeams() {
  if (!adminTeamsList) return;
  adminTeamsList.replaceChildren();

  if (!App.state.teams.length) {
    showError(adminTeamsList, "لا توجد فرق مسجلة حتى الآن.");
    return;
  }

  App.state.teams.forEach((team) => {
    const card = createElement("article", "admin-team-card");
    card.appendChild(createElement("h3", "", team.name || "فريق جديد"));

    function makeInputField(labelText, value, type = "text") {
      const field = createElement("div", "admin-team-field");
      const label = createElement("label", "", labelText);
      const input = document.createElement("input");
      input.type = type;
      input.value = value || "";
      field.append(label, input);
      return { field, input };
    }

    const arabicName = makeInputField("اسم الفريق بالعربية", team.name);
    const englishName = makeInputField("اسم الفريق بالإنجليزية", team.english_name);
    const leader = makeInputField("اسم القائد", team.leader);

    const colorField = createElement("div", "admin-team-field");
    const colorLabel = createElement("label", "", "لون الفريق");
    const colorWrapper = createElement("div", "admin-team-color");
    const colorPicker = document.createElement("input");
    colorPicker.type = "color";
    const colorHex = document.createElement("input");
    colorHex.type = "text";
    colorHex.placeholder = "#E3B64A";

    const currentColor = /^#[0-9A-Fa-f]{6}$/.test(team.color || "") ? team.color : "#e3b64a";
    colorPicker.value = currentColor;
    colorHex.value = team.color || currentColor;
    colorPicker.addEventListener("input", () => colorHex.value = colorPicker.value);
    colorHex.addEventListener("input", () => {
      if (/^#[0-9A-Fa-f]{6}$/.test(colorHex.value)) colorPicker.value = colorHex.value;
    });
    colorWrapper.append(colorPicker, colorHex);
    colorField.append(colorLabel, colorWrapper);

    const membersField = createElement("div", "admin-team-field");
    const membersLabel = createElement("label", "", "أعضاء الفريق");
    const membersInput = document.createElement("textarea");
    membersInput.className = "admin-team-members";
    membersInput.placeholder = "اكتب اسم كل عضو في سطر منفصل";
    membersInput.value = Array.isArray(team.members) ? team.members.join("\n") : "";
    membersField.append(membersLabel, membersInput);

    const message = createElement("p", "admin-team-message");
    const saveButton = createElement("button", "admin-save-team", "حفظ التعديلات");
    saveButton.type = "button";

    saveButton.addEventListener("click", async () => {
      const name = arabicName.input.value.trim();
      const english_name = englishName.input.value.trim();
      const teamLeader = leader.input.value.trim();
      const color = colorHex.value.trim();
      const members = membersInput.value.split("\n").map(v => v.trim()).filter(Boolean);

      if (!name || !english_name || !teamLeader) {
        message.textContent = "أكمل اسم الفريق بالعربية والإنجليزية واسم القائد.";
        return;
      }
      if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
        message.textContent = "أدخل كود لون صحيحًا بصيغة HEX مثل #E3B64A.";
        return;
      }

      saveButton.disabled = true;
      saveButton.textContent = "جارٍ حفظ التعديلات...";
      message.textContent = "";

      try {
        const { error } = await db.from("teams").update({
          name, english_name, color, leader: teamLeader, members
        }).eq("id", team.id);
        if (error) throw error;
        await App.loadAll();
        alert("تم حفظ تعديلات الفريق بنجاح.");
      } catch (error) {
        console.error("Update team error:", error);
        message.textContent = "تعذر حفظ التعديلات: " + (error.message || "حاول مرة أخرى.");
        saveButton.disabled = false;
        saveButton.textContent = "حفظ التعديلات";
      }
    });

    card.append(
      arabicName.field, englishName.field, leader.field,
      colorField, membersField, saveButton, message
    );
    adminTeamsList.appendChild(card);
  });
}

// ==========================================
// ANNOUNCEMENTS / CHAMPIONS / PERFORMERS
// All record edit/delete buttons use ONE delegated click handler.
// ==========================================

const adminAnnouncementsList = $("admin-announcements-list");
const adminAnnouncementForm = $("admin-announcement-form");
const announcementFormMessage = $("announcement-form-message");

const adminChampionForm = $("admin-champion-form");
const adminChampionsList = $("admin-champions-list");
const championFormMessage = $("champion-form-message");

const adminPerformerForm = $("admin-performer-form");
const adminPerformersList = $("admin-performers-list");
const performerFormMessage = $("performer-form-message");

function makeActionButton(label, action, id, className = "") {
  const button = createElement("button", className, label);
  button.type = "button";
  button.dataset.adminAction = action;
  button.dataset.recordId = String(id);
  return button;
}

function renderAdminAnnouncements() {
  if (!adminAnnouncementsList) return;
  adminAnnouncementsList.replaceChildren();

  if (!App.state.announcements.length) {
    showError(adminAnnouncementsList, "لا توجد إعلانات مسجلة حتى الآن.");
    return;
  }

  App.state.announcements.forEach((announcement) => {
    const card = createElement("article", "admin-team-card");
    card.append(
      createElement("h3", "", announcement.title),
      createElement("p", "", announcement.body),
      createElement("p", "announcement-date", formatDate(announcement.created_at)),
      makeActionButton("تعديل الإعلان", "edit-announcement", announcement.id, "admin-save-team"),
      makeActionButton("حذف الإعلان", "delete-announcement", announcement.id, "admin-save-team")
    );
    adminAnnouncementsList.appendChild(card);
  });
}

function renderAdminChampions() {
  if (!adminChampionsList) return;
  adminChampionsList.replaceChildren();

  if (!App.state.champions.length) {
    showError(adminChampionsList, "لا توجد سجلات أبطال حتى الآن.");
    return;
  }

  App.state.champions.forEach((champion) => {
    const card = createElement("article", "admin-record-card");
    const actions = createRecordActions();
    actions.append(
      makeActionButton("تعديل", "edit-champion", champion.id),
      makeActionButton("حذف", "delete-champion", champion.id, "admin-record-delete")
    );
    card.append(
      createElement("h3", "", champion.title || "بطل"),
      createElement("p", "", Number(champion.rank) ? `المركز: ${["", "الأول", "الثاني", "الثالث"][Number(champion.rank)]}` : "غير محدد على المنصة"),
      createElement("p", "", champion.details || "لا توجد تفاصيل."),
      actions
    );
    adminChampionsList.appendChild(card);
  });
}

function fillPerformerTeams() {
  const select = $("performer-team");
  if (!select) return;
  const selectedValue = select.value;
  select.replaceChildren(new Option("اختر الفريق", ""));
  App.state.teams.forEach(team => select.add(new Option(team.name, team.id)));
  if (App.state.teams.some(team => String(team.id) === String(selectedValue))) {
    select.value = selectedValue;
  }
}

function renderAdminPerformers() {
  if (!adminPerformersList) return;
  fillPerformerTeams();
  adminPerformersList.replaceChildren();

  if (!App.state.performers.length) {
    showError(adminPerformersList, "لا يوجد لاعبون مميزون مسجلون حتى الآن.");
    return;
  }

  App.state.performers.forEach((player) => {
    const team = App.state.teams.find(item => String(item.id) === String(player.team_id));
    const card = createElement("article", "admin-record-card");
    const actions = createRecordActions();
    actions.append(
      makeActionButton("تعديل", "edit-performer", player.id),
      makeActionButton("حذف", "delete-performer", player.id, "admin-record-delete")
    );
    card.append(
      createElement("h3", "", player.player_name || "لاعب"),
      createElement("p", "", Number(player.rank) ? `المركز: ${["", "الأول", "الثاني", "الثالث"][Number(player.rank)]}` : "غير محدد على المنصة"),
      createElement("p", "", "الفريق: " + (team?.name || "غير محدد")),
      createElement("p", "", "الإنجاز: " + (player.achievement || "غير محدد")),
      actions
    );
    adminPerformersList.appendChild(card);
  });
}

// Central delegated event handler - survives re-rendering of all three lists.
if (adminDashboard) {
  adminDashboard.addEventListener("click", async (event) => {
    const button = event.target instanceof Element
      ? event.target.closest("button[data-admin-action][data-record-id]")
      : null;

    if (!button || !adminDashboard.contains(button)) return;

    const action = button.dataset.adminAction;
    const id = button.dataset.recordId;
    const isEdit = action.startsWith("edit-");
    const isDelete = action.startsWith("delete-");
    if (!isEdit && !isDelete) return;

    event.preventDefault();
    event.stopPropagation();

    const configs = {
      announcement: {
        table: "announcements",
        records: App.state.announcements,
        label: "الإعلان"
      },
      champion: {
        table: "champions_history",
        records: App.state.champions,
        label: "سجل البطل"
      },
      performer: {
        table: "top_performers",
        records: App.state.performers,
        label: "اللاعب المميز"
      }
    };

    const type = action.replace(/^(edit|delete)-/, "");
    const config = configs[type];
    if (!config) return;

    const record = config.records.find(item => String(item.id) === String(id));
    if (!record) {
      alert("لم يتم العثور على السجل. حدّث الصفحة وحاول مرة أخرى.");
      return;
    }

    if (isDelete) {
      if (!window.confirm(`هل أنت متأكد من حذف ${config.label}؟`)) return;

      button.disabled = true;
      const oldText = button.textContent;
      button.textContent = "جارٍ الحذف...";

      try {
        const { data, error } = await db.from(config.table).delete().eq("id", record.id).select("id");
        if (error) throw error;
        if (!data || data.length === 0) {
          throw new Error("لم يتم حذف أي سجل. تحقق من صلاحيات قاعدة البيانات وسياسة RLS.");
        }
        await App.loadAll();
        alert(`تم حذف ${config.label} بنجاح.`);
      } catch (error) {
        showDatabaseError(`تعذر حذف ${config.label}`, error);
        button.disabled = false;
        button.textContent = oldText;
      }
      return;
    }

    let updates = {};

    if (type === "announcement") {
      const title = window.prompt("أدخل عنوان الإعلان الجديد:", record.title || "");
      if (title === null) return;
      const body = window.prompt("أدخل محتوى الإعلان الجديد:", record.body || "");
      if (body === null) return;
      if (!title.trim() || !body.trim()) {
        alert("أدخل عنوان الإعلان ومحتواه.");
        return;
      }
      updates = { title: title.trim(), body: body.trim() };
    }

    if (type === "champion") {
      const title = window.prompt("أدخل اسم البطل أو اللقب:", record.title || "");
      if (title === null) return;
      const details = window.prompt("أدخل تفاصيل الإنجاز:", record.details || "");
      if (details === null) return;
      if (!title.trim()) {
        alert("أدخل اسم البطل أو اللقب.");
        return;
      }
      const rankChoice = window.prompt("اختاري المركز: 1 للأول، 2 للثاني، 3 للثالث", String(record.rank || 1));
      if (rankChoice === null) return;
      const rank = Number(rankChoice);
      if (![1, 2, 3].includes(rank)) { alert("المركز يجب أن يكون 1 أو 2 أو 3."); return; }
      updates = { title: title.trim(), details: details.trim(), rank };
    }

    if (type === "performer") {
      const playerName = window.prompt("أدخل اسم اللاعب:", record.player_name || "");
      if (playerName === null) return;
      const achievement = window.prompt("أدخل الإنجاز:", record.achievement || "");
      if (achievement === null) return;
      if (!playerName.trim() || !achievement.trim()) {
        alert("أدخل اسم اللاعب والإنجاز.");
        return;
      }

      const teamOptions = App.state.teams.map((team, index) => `${index + 1}. ${team.name}`).join("\n");
      const currentIndex = App.state.teams.findIndex(team => String(team.id) === String(record.team_id));
      const choice = window.prompt("اكتب رقم الفريق:\n" + teamOptions, String(currentIndex + 1));
      if (choice === null) return;
      const selectedTeam = App.state.teams[Number(choice) - 1];
      if (!Number.isInteger(Number(choice)) || !selectedTeam || Number(choice) < 1) {
        alert("رقم الفريق غير صحيح.");
        return;
      }

      const rankChoice = window.prompt("اختاري المركز: 1 للأول، 2 للثاني، 3 للثالث", String(record.rank || 1));
      if (rankChoice === null) return;
      const rank = Number(rankChoice);
      if (![1, 2, 3].includes(rank)) { alert("المركز يجب أن يكون 1 أو 2 أو 3."); return; }

      updates = {
        player_name: playerName.trim(),
        achievement: achievement.trim(),
        team_id: selectedTeam.id,
        rank
      };
    }

    button.disabled = true;
    const oldText = button.textContent;
    button.textContent = "جارٍ الحفظ...";

    try {
      const { data, error } = await db
        .from(config.table)
        .update(updates)
        .eq("id", record.id)
        .select("id");

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("لم يتم تعديل أي سجل. تحقق من صلاحيات قاعدة البيانات وسياسة RLS.");
      }
      if (type === "champion" || type === "performer") {
        await clearOtherPodiumSlots(config.table, updates.rank, record.id);
      }

      await App.loadAll();
      alert(`تم تعديل ${config.label} بنجاح.`);
    } catch (error) {
      showDatabaseError(`تعذر تعديل ${config.label}`, error);
      button.disabled = false;
      button.textContent = oldText;
    }
  });
}

// ==========================================
// ADD ANNOUNCEMENT
// ==========================================

if (adminAnnouncementForm) {
  adminAnnouncementForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const title = $("announcement-title")?.value.trim();
    const body = $("announcement-body")?.value.trim();

    if (!title || !body) {
      showAdminMessage(announcementFormMessage, "أدخل عنوان الإعلان ومحتواه.");
      return;
    }

    const submitButton = adminAnnouncementForm.querySelector('button[type="submit"]');
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "جارٍ نشر الإعلان...";
    }
    showAdminMessage(announcementFormMessage, "");

    try {
      const { error } = await db.from("announcements").insert({ title, body });
      if (error) throw error;
      adminAnnouncementForm.reset();
      showAdminMessage(announcementFormMessage, "تم نشر الإعلان بنجاح.");
      await App.loadAll();
    } catch (error) {
      console.error("Add announcement error:", error);
      showAdminMessage(announcementFormMessage, "تعذر نشر الإعلان: " + (error.message || "حاول مرة أخرى."));
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "نشر الإعلان";
      }
    }
  });
}

// ==========================================
// ADD CHAMPION
// ==========================================

if (adminChampionForm) {
  adminChampionForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const title = $("champion-title")?.value.trim();
    const details = $("champion-details")?.value.trim() || "";
    const rank = Number($("champion-rank")?.value);

    if (!title || ![1, 2, 3].includes(rank)) {
      showAdminMessage(championFormMessage, "أدخل اسم البطل واختَر المركز.");
      return;
    }

    const submitButton = adminChampionForm.querySelector('button[type="submit"]');
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "جارٍ الحفظ...";
    }
    showAdminMessage(championFormMessage, "");

    try {
      const { data, error } = await db.from("champions_history")
        .insert({ title, details, rank })
        .select("id")
        .single();
      if (error) throw error;
      await clearOtherPodiumSlots("champions_history", rank, data.id);
      adminChampionForm.reset();
      showAdminMessage(championFormMessage, "تمت إضافة سجل البطل بنجاح.");
      await App.loadAll();
    } catch (error) {
      console.error("Add champion error:", error);
      showAdminMessage(championFormMessage, "تعذر إضافة السجل: " + (error.message || "راجع اتصال قاعدة البيانات."));
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "إضافة سجل البطل";
      }
    }
  });
}

// ==========================================
// ADD PERFORMER
// ==========================================

if (adminPerformerForm) {
  adminPerformerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const playerName = $("performer-name")?.value.trim();
    const teamId = $("performer-team")?.value;
    const achievement = $("performer-achievement")?.value.trim();
    const rank = Number($("performer-rank")?.value);

    if (!playerName || !teamId || !achievement || ![1, 2, 3].includes(rank)) {
      showAdminMessage(performerFormMessage, "أكمل بيانات اللاعب واختَر المركز.");
      return;
    }

    const submitButton = adminPerformerForm.querySelector('button[type="submit"]');
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "جارٍ الحفظ...";
    }
    showAdminMessage(performerFormMessage, "");

    try {
      const { data, error } = await db.from("top_performers")
        .insert({ player_name: playerName, team_id: teamId, achievement, rank })
        .select("id")
        .single();
      if (error) throw error;
      await clearOtherPodiumSlots("top_performers", rank, data.id);
      adminPerformerForm.reset();
      showAdminMessage(performerFormMessage, "تمت إضافة اللاعب المميز بنجاح.");
      await App.loadAll();
    } catch (error) {
      console.error("Add performer error:", error);
      showAdminMessage(performerFormMessage, "تعذر إضافة اللاعب: " + (error.message || "تحقق من أعمدة جدول top_performers."));
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "إضافة اللاعب المميز";
      }
    }
  });
}

// ==========================================
// ADMIN USERS MANAGEMENT
// ==========================================

const adminUsersList = $("admin-users-list");

async function renderAdminUsers() {
  if (!adminUsersList) return;
  showError(adminUsersList, "جارٍ تحميل قائمة المسؤولين...");

  try {
    const { data, error } = await db.functions.invoke("manage-admins", {
      body: { action: "list" }
    });
    if (error) throw new Error(error.message || "تعذر الاتصال بالخادم.");
    if (!data?.success) throw new Error(data?.error || "تعذر تحميل قائمة المسؤولين.");

    const admins = data.admins || [];
    adminUsersList.replaceChildren();

    if (!admins.length) {
      showError(adminUsersList, "لا توجد حسابات مسؤولين مسجلة.");
      return;
    }

    admins.forEach((admin) => {
      const row = createElement("div", "admin-user-row");
      row.append(
        createElement("strong", "", admin.role === "super_admin" ? "المسؤول الرئيسي" : "مسؤول إضافي"),
        createElement("span", "", "معرّف الحساب: " + admin.user_id),
        createElement("span", "", "تاريخ الإضافة: " + formatDate(admin.created_at))
      );

      if (admin.role !== "super_admin") {
        const removeButton = createElement("button", "admin-record-delete", "سحب الصلاحية");
        removeButton.type = "button";
        removeButton.addEventListener("click", async () => {
          if (!confirm("هل تريد سحب صلاحيات هذا المسؤول؟")) return;
          removeButton.disabled = true;
          try {
            const { data: result, error: invokeError } = await db.functions.invoke("manage-admins", {
              body: { action: "remove", user_id: admin.user_id }
            });
            if (invokeError || !result?.success) {
              throw new Error(result?.error || invokeError?.message || "تعذر سحب الصلاحية.");
            }
            alert(result.message || "تم سحب الصلاحية.");
            await renderAdminUsers();
          } catch (error) {
            showDatabaseError("حدث خطأ أثناء سحب الصلاحية", error);
            removeButton.disabled = false;
          }
        });
        row.appendChild(removeButton);
      }
      adminUsersList.appendChild(row);
    });
  } catch (error) {
    console.error("Load admins error:", error);
    showError(adminUsersList, error.message || "تعذر تحميل قائمة المسؤولين.");
  }
}

// ==========================================
// ADD ADMIN
// ==========================================

const adminAddForm = $("admin-add-form");

if (adminAddForm) {
  adminAddForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const emailInput = $("new-admin-email");
    const message = $("admin-manage-message");
    const submitButton = adminAddForm.querySelector('button[type="submit"]');
    const email = emailInput?.value.trim();

    if (!email) {
      if (message) message.textContent = "أدخل البريد الإلكتروني.";
      return;
    }
    if (submitButton) submitButton.disabled = true;
    if (message) message.textContent = "جارٍ إرسال الدعوة...";

    try {
      const { data, error } = await db.functions.invoke("manage-admins", {
        body: { action: "add", email }
      });
      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || "تعذرت إضافة المسؤول.");
      }
      if (message) message.textContent = data.message || "تمت إضافة المسؤول.";
      adminAddForm.reset();
      await renderAdminUsers();
    } catch (error) {
      console.error("Add admin error:", error);
      if (message) message.textContent = error.message || "حدث خطأ أثناء الإضافة.";
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}

// ==========================================
// INITIAL RENDER
// ==========================================

console.log("Fajr Al-Asatir admin system initialized.");
 
/* ==========================================
   FAJR AL-ASATIR - PASSWORD RECOVERY
========================================== */

(() => {
  const recoveryModal = document.getElementById("password-recovery-modal");
  const recoveryForm = document.getElementById("recoveryForm");
  const recoveryMessage = document.getElementById("recoveryMessage");
  const recoverySubmit = document.getElementById("recoverySubmit");
  const newPassword = document.getElementById("newPassword");
  const confirmPassword = document.getElementById("confirmPassword");

  if (!recoveryModal || !recoveryForm) {
    console.error("Password recovery elements are missing.");
    return;
  }

  // استقبال رابط استعادة كلمة المرور من Supabase
  db.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY" && session) {
      recoveryModal.classList.add("active");
      recoveryMessage.textContent = "اكتب كلمة المرور الجديدة.";
    }
  });

  // حفظ كلمة المرور الجديدة
  recoveryForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const password = newPassword.value;
    const confirmation = confirmPassword.value;

    if (password.length < 8) {
      recoveryMessage.textContent =
        "كلمة المرور يجب أن تكون 8 أحرف على الأقل.";
      return;
    }

    if (password !== confirmation) {
      recoveryMessage.textContent =
        "كلمتا المرور غير متطابقتين.";
      return;
    }

    recoverySubmit.disabled = true;
    recoveryMessage.textContent = "جارٍ حفظ كلمة المرور...";

    try {
      const { error } = await db.auth.updateUser({
        password: password
      });

      if (error) throw error;

      recoveryMessage.textContent =
        "تم تغيير كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول.";

      recoveryForm.reset();
      recoverySubmit.textContent = "تم تغيير كلمة المرور";

      await db.auth.signOut();

    } catch (error) {
      console.error("Password recovery error:", error);
      recoveryMessage.textContent =
        error.message || "تعذر تغيير كلمة المرور. حاول مرة أخرى.";
      recoverySubmit.disabled = false;
    }
  });
})();

