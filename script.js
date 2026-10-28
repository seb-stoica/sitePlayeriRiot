// Regiunea de joc (platforma) -> regiunea de rutare pentru account-v1
const ROUTING = { eun1: "europe", euw1: "europe", tr1: "europe", na1: "americas", br1: "americas", kr: "asia" };
const PLATFORMS = { europe: ["eun1", "euw1", "tr1"], americas: ["na1", "br1"], asia: ["kr"] };
const QUEUES = { RANKED_SOLO_5x5: "Ranked Solo/Duo", RANKED_FLEX_SR: "Ranked Flex" };

const TIER_COLORS = {
  IRON: "#6b5d5f", BRONZE: "#a8643f", SILVER: "#8ea6ad", GOLD: "#d99a3d", PLATINUM: "#4e9996",
  EMERALD: "#1fb56a", DIAMOND: "#6b83e8", MASTER: "#b45bf0", GRANDMASTER: "#e04b4b", CHALLENGER: "#f4c874",
};
const TIER_NAMES = {
  IRON: "Iron", BRONZE: "Bronze", SILVER: "Silver", GOLD: "Gold", PLATINUM: "Platinum", EMERALD: "Emerald",
  DIAMOND: "Diamond", MASTER: "Master", GRANDMASTER: "Grandmaster", CHALLENGER: "Challenger",
};
const ROMAN = { I: 1, II: 2, III: 3, IV: 4 };

// Fundal: splash art aleatoriu din Data Dragon
const SPLASHES = ["Ahri_0", "Jinx_0", "Yasuo_0", "Lux_0", "Ekko_0", "Viego_0", "Kaisa_0", "Leona_0", "Sett_0", "Aphelios_0"];
document.getElementById("backdrop").style.backgroundImage =
  `url(https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${SPLASHES[Math.floor(Math.random() * SPLASHES.length)]}.jpg)`;

const form = document.getElementById("search");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");

// Apelează Riot API prin serverul nostru (cheia nu ajunge în browser)
async function riot(host, path, notFoundMsg = "Resursa nu a fost găsită.") {
  const res = await fetch(`/api/riot?host=${host}.api.riotgames.com&path=${encodeURIComponent(path)}`);
  if (res.status === 404) throw new Error(notFoundMsg);
  if (res.status === 429) throw new Error("Prea multe cereri. Încearcă din nou peste un minut.");
  if (res.status === 401 || res.status === 403) throw new Error("Cheia API este invalidă sau a expirat.");
  if (!res.ok) throw new Error("Eroare de la Riot API (" + res.status + ").");
  return res.json();
}

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.className = isError ? "error" : "";
}

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const [name, tag] = document.getElementById("riotId").value.trim().split("#");
  if (!name || !tag) return setStatus("Folosește formatul Nume#TAG.", true);

  const platform = document.getElementById("region").value;
  const button = form.querySelector("button");
  button.disabled = true;
  resultEl.hidden = true;
  setStatus("Se caută…");

  try {
    const account = await riot(ROUTING[platform],
      `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(name.trim())}/${encodeURIComponent(tag.trim())}`,
      "Nu există niciun Riot ID cu acest nume și TAG. Verifică ortografia.");

    // Contul există global; jucătorul poate fi pe alt server decât cel ales, așa că le încercăm pe rând
    const order = [platform, ...PLATFORMS[ROUTING[platform]].filter(p => p !== platform)];
    let summoner = null, usedPlatform = null;
    for (const p of order) {
      try {
        summoner = await riot(p, `/lol/summoner/v4/summoners/by-puuid/${account.puuid}`, "nf");
        usedPlatform = p;
        break;
      } catch (err) {
        if (err.message !== "nf") throw err;
      }
    }
    if (!summoner) throw new Error("Contul există, dar nu are un profil League of Legends pe acest grup de servere.");

    const [ranks, versions] = await Promise.all([
      riot(usedPlatform, `/lol/league/v4/entries/by-puuid/${account.puuid}`),
      fetch("https://ddragon.leagueoflegends.com/api/versions.json").then(r => r.json()),
    ]);
    render(account, summoner, ranks, versions[0]);
    setStatus("");
  } catch (err) {
    console.error(err);
    setStatus(err.message, true);
  } finally {
    button.disabled = false;
  }
});

function render(account, summoner, ranks, version) {
  const icon = `https://ddragon.leagueoflegends.com/cdn/${version}/img/profileicon/${summoner.profileIconId}.png`;
  const rows = ranks.filter(r => QUEUES[r.queueType]).map(r => {
    const total = r.wins + r.losses;
    const wr = total ? Math.round((r.wins / total) * 100) : 0;
    const apex = ["MASTER", "GRANDMASTER", "CHALLENGER"].includes(r.tier);
    return `<div class="rank" style="--tier:${TIER_COLORS[r.tier] || "#c8aa6e"}">
      <div class="emblem"><b>${apex ? "★" : ROMAN[r.rank] || ""}</b></div>
      <div class="info">
        <div class="queue">${QUEUES[r.queueType]}</div>
        <div class="tier">${TIER_NAMES[r.tier] || esc(r.tier)}${apex ? "" : " " + esc(r.rank)}</div>
        <div class="lp">${r.leaguePoints} LP</div>
      </div>
      <div class="wl"><strong>${wr}%</strong>${r.wins}V ${r.losses}Î</div>
    </div>`;
  }).join("");

  resultEl.innerHTML = `
    <div class="profile">
      <div class="icon"><img src="${icon}" alt="Iconița de profil"><span class="lvl">${summoner.summonerLevel}</span></div>
      <h2>${esc(account.gameName)} <span>#${esc(account.tagLine)}</span></h2>
    </div>
    <h3 class="section-title">Clasament ranked</h3>
    ${rows || `<p class="empty">Acest jucător nu are încă un rang în acest sezon.</p>`}`;
  resultEl.hidden = false;
}