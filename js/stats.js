/**
 * Match statistics — Valorant-style combat scoreboard data.
 */
export class MatchStats {
  constructor() {
    this.reset();
  }

  reset() {
    this.player = {
      name: 'You',
      kills: 0,
      deaths: 0,
      assists: 0,
      headshots: 0,
      bodyshots: 0,
      legshots: 0,
      damageDealt: 0,
      damageTaken: 0,
    };
    this.bots = {};
    this.roundsWon = 0;
    this.roundsLost = 0;
  }

  initBots(botList) {
    for (const b of botList) {
      this.bots[b.id] = {
        id: b.id,
        name: b.name,
        kills: 0,
        deaths: 0,
        assists: 0,
        damageDealt: 0,
        alive: true,
      };
    }
  }

  recordPlayerHit(damage, hitZone) {
    this.player.damageDealt += Math.round(damage);
    if (hitZone === 'head') this.player.headshots++;
    else if (hitZone === 'leg') this.player.legshots++;
    else this.player.bodyshots++;
  }

  recordPlayerKill(botId, botName) {
    this.player.kills++;
    if (this.bots[botId]) {
      this.bots[botId].deaths++;
      this.bots[botId].alive = false;
    }
  }

  recordPlayerDeath(killerName) {
    this.player.deaths++;
    for (const b of Object.values(this.bots)) {
      if (b.name === killerName) b.kills++;
    }
  }

  recordPlayerDamageTaken(dmg) {
    this.player.damageTaken += Math.round(dmg);
  }

  recordRoundWin() { this.roundsWon++; }
  recordRoundLoss() { this.roundsLost++; }

  getKDA(entity) {
    const k = entity.kills;
    const d = entity.deaths;
    const a = entity.assists ?? 0;
    return d === 0 ? k + a : ((k + a) / d).toFixed(2);
  }

  /** Valorant-style ACS approximation for player. */
  getACS() {
    const score = this.player.kills * 150 + this.player.headshots * 50 +
      this.player.damageDealt * 0.1;
    const rounds = Math.max(1, this.roundsWon + this.roundsLost);
    return Math.round(score / rounds);
  }

  getScoreboardRows() {
    const rows = [{
      ...this.player,
      kda: this.getKDA(this.player),
      acs: this.getACS(),
      team: 'attack',
    }];
    for (const b of Object.values(this.bots)) {
      rows.push({
        name: b.name,
        kills: b.kills,
        deaths: b.deaths,
        assists: b.assists,
        damageDealt: b.damageDealt,
        kda: this.getKDA(b),
        acs: Math.round(b.kills * 120 / Math.max(1, this.roundsWon + this.roundsLost)),
        team: 'defend',
        alive: b.alive,
      });
    }
    return rows;
  }
}

export function formatTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}
