import { Context, Handler, PRIV, Types, param, post } from 'hydrooj';
import * as fs from 'fs';
import * as path from 'path';

const DATA_FILE = path.resolve(__dirname, 'honor.json');
let honorData: any = null;
let dataPath = DATA_FILE;

function loadData(): any {
    if (!honorData) {
        honorData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    }
    return honorData;
}

function saveData() {
    fs.writeFileSync(dataPath, JSON.stringify(honorData, null, 2), 'utf-8');
}

// ---- Category helpers ----
function getRecordCount(cat: any): number {
    if (cat.records) return cat.records.length;
    if (cat.events) {
        let n = 0;
        for (const e of cat.events) {
            if (e.venues) for (const v of e.venues) n += v.teams.length;
            if (e.teams) n += e.teams.length;
        }
        return n;
    }
    return 0;
}

function recalcCounts() {
    for (const cat of honorData.categories) {
        cat.total_teams = getRecordCount(cat);
    }
    honorData.summary.total_records = honorData.categories.reduce((s: number, c: any) => s + (c.total_teams || 0), 0);
}

// ---- Display Handler ----
class HonorMainHandler extends Handler {
    async get() {
        const data = loadData();
        this.response.template = 'honor.html';
        this.response.body = {
            categories: data.categories,
            institution: data.institution,
            summary: data.summary,
            canEdit: this.user.hasPriv(PRIV.PRIV_MOD_BADGE),
        };
    }
}

// ---- Edit Page Handler ----
class HonorEditHandler extends Handler {
    async get() {
        this.checkPriv(PRIV.PRIV_MOD_BADGE);
        const data = loadData();
        this.response.template = 'honor_edit.html';
        this.response.body = {
            categories: data.categories,
        };
    }
}

// ---- CRUD Handler ----
class HonorManageHandler extends Handler {
    @post('action', Types.String)
    @post('cat', Types.Int)        // category index
    @post('year', Types.String, true)    // for ICPC/CCPC
    @post('venue', Types.String, true)  // for ICPC/CCPC
    @post('session', Types.String, true) // for Sichuan
    @post('team', Types.String, true)
    @post('member1', Types.String, true)
    @post('member2', Types.String, true)
    @post('member3', Types.String, true)
    @post('award', Types.String, true)
    @post('competition', Types.String, true) // for World Finals
    @post('newTeam', Types.String, true)
    @post('newMember1', Types.String, true)
    @post('newMember2', Types.String, true)
    @post('newMember3', Types.String, true)
    @post('newAward', Types.String, true)
    async post(
        domainId: string, action: string, catIdx: number,
        year: string, venue: string, session: string,
        team: string, member1: string, member2: string, member3: string, award: string,
        competition: string,
        newTeam: string, newMember1: string, newMember2: string, newMember3: string, newAward: string,
    ) {
        this.checkPriv(PRIV.PRIV_MOD_BADGE);
        loadData();
        const cat = honorData.categories[catIdx];
        if (!cat) { this.response.body = { ok: false, error: 'Invalid category' }; return; }

        try {
            switch (action) {
            case 'add': {
                const record = this.doAdd(cat, catIdx, year, venue, session, team, member1, member2, member3, award, competition);
                recalcCounts();
                saveData();
                this.response.body = { ok: true, action: 'add', cat: catIdx, year: year || '', venue: venue || '', session: session || '', record };
                return;
            }
            case 'edit':
                this.doEdit(cat, catIdx, year, venue, session, team, newTeam, newMember1, newMember2, newMember3, newAward); break;
            case 'delete':
                this.doDelete(cat, catIdx, year, venue, session, team); break;
            case 'move':
                this.doMove(cat, catIdx, year, venue, session, team, parseInt(newTeam) || 1); break;
            default: this.response.body = { ok: false, error: 'Unknown action' }; return;
            }
            recalcCounts();
            saveData();
            this.response.body = { ok: true, action };
        } catch (e: any) {
            this.response.body = { ok: false, error: e.message };
        }
    }

    doAdd(cat: any, catIdx: number, year: string, venue: string, session: string,
          team: string, m1: string, m2: string, m3: string, award: string, competition: string): any {
        const members = [m1 || '', m2 || '', m3 || ''].filter(Boolean);
        if (!team || !award) throw new Error('Team and award are required');

        if (cat.records) {
            // World Finals
            const rec = { team, competition: competition || '', members, award };
            cat.records.push(rec);
            return rec;
        } else if (cat.events) {
            if (session) {
                // Sichuan
                let ev = cat.events.find((e: any) => e.session === session);
                if (!ev) { ev = { session, teams: [] }; cat.events.push(ev); }
                const rec = { team, members, award };
                ev.teams.push(rec);
                return rec;
            } else if (year && venue) {
                // ICPC / CCPC
                let ev = cat.events.find((e: any) => e.year === year);
                if (!ev) { ev = { year, venues: [] }; cat.events.push(ev); }
                if (ev.venues) {
                    let v = ev.venues.find((vv: any) => vv.name === venue);
                    if (!v) { v = { name: venue, teams: [] }; ev.venues.push(v); }
                    const rec = { team, members, award };
                    v.teams.push(rec);
                    return rec;
                }
            } else {
                throw new Error('Need year+venue or session for this category');
            }
        }
    }

    doEdit(cat: any, catIdx: number, year: string, venue: string, session: string,
           team: string, newTeam: string, m1: string, m2: string, m3: string, award: string) {
        const members = [m1, m2, m3].filter(Boolean);
        const t = this.findTeam(cat, year, venue, session, team);
        if (!t) throw new Error('Team not found');
        if (newTeam) t.team = newTeam;
        if (members.length) t.members = members;
        if (award) t.award = award;
    }

    doDelete(cat: any, catIdx: number, year: string, venue: string, session: string, team: string) {
        if (cat.records) {
            const idx = cat.records.findIndex((r: any) => r.team === team);
            if (idx === -1) throw new Error('Team not found');
            cat.records.splice(idx, 1);
        } else if (cat.events) {
            if (session) {
                for (const ev of cat.events) {
                    if (ev.session !== session) continue;
                    const idx = ev.teams.findIndex((t: any) => t.team === team);
                    if (idx === -1) throw new Error('Team not found');
                    ev.teams.splice(idx, 1);
                    if (ev.teams.length === 0) cat.events = cat.events.filter((e: any) => e !== ev);
                    return;
                }
            } else if (year && venue) {
                for (const ev of cat.events) {
                    if (ev.year !== year) continue;
                    for (const v of ev.venues) {
                        if (v.name !== venue) continue;
                        const idx = v.teams.findIndex((t: any) => t.team === team);
                        if (idx === -1) throw new Error('Team not found');
                        v.teams.splice(idx, 1);
                        if (v.teams.length === 0) ev.venues = ev.venues.filter((vv: any) => vv !== v);
                        if (ev.venues.length === 0) cat.events = cat.events.filter((e: any) => e !== ev);
                        return;
                    }
                }
            }
            throw new Error('Team not found');
        }
    }

    doMove(cat: any, catIdx: number, year: string, venue: string, session: string, team: string, dir: number) {
        const arr = this.getTeamArray(cat, year, venue, session);
        if (!arr) throw new Error('Cannot find record list');
        const idx = arr.findIndex((t: any) => t.team === team);
        if (idx === -1) throw new Error('Team not found');
        const target = idx + dir;
        if (target < 0 || target >= arr.length) throw new Error('Cannot move further');
        [arr[idx], arr[target]] = [arr[target], arr[idx]];
    }

    getTeamArray(cat: any, year: string, venue: string, session: string): any[] | null {
        if (cat.records) return cat.records;
        if (cat.events) {
            if (session) {
                for (const ev of cat.events) if (ev.session === session) return ev.teams;
            } else if (year && venue) {
                for (const ev of cat.events) {
                    if (ev.year !== year) continue;
                    for (const v of ev.venues) if (v.name === venue) return v.teams;
                }
            }
        }
        return null;
    }

    findTeam(cat: any, year: string, venue: string, session: string, team: string): any {
        if (cat.records) return cat.records.find((r: any) => r.team === team);
        if (cat.events) {
            if (session) {
                for (const ev of cat.events) {
                    if (ev.session !== session) continue;
                    return ev.teams.find((t: any) => t.team === team);
                }
            } else if (year && venue) {
                for (const ev of cat.events) {
                    if (ev.year !== year) continue;
                    for (const v of ev.venues) {
                        if (v.name !== venue) continue;
                        return v.teams.find((t: any) => t.team === team);
                    }
                }
            }
        }
        return null;
    }
}

// ---- Plugin entry ----
export function apply(ctx: Context) {
    ctx.Route('honor_main', '/honor', HonorMainHandler);
    ctx.Route('honor_edit', '/honor/edit', HonorEditHandler, PRIV.PRIV_MOD_BADGE);
    ctx.Route('honor_manage', '/honor/manage', HonorManageHandler, PRIV.PRIV_MOD_BADGE);
    ctx.injectUI('Nav', 'honor_main', { icon: 'award' });
    ctx.i18n.load('zh', {
        'honor_main': 'Honor',
        'World Finals': '世界总决赛',
        'ICPC Asia Regional': 'ICPC 亚洲区竞赛',
        'CCPC': 'CCPC 中国大学生程序设计竞赛',
        'Sichuan Provincial Contest': '四川省大学生程序设计竞赛',
        'Team': '队伍',
        'Members': '队员',
        'Award': '奖项',
        'Competition': '赛事',
        'Venue': '赛区',
        'Year': '年份',
        'Session': '届次',
        'Add Record': '添加记录',
        'Edit': '编辑',
        'Delete': '删除',
        'Save': '保存',
        'Cancel': '取消',
        'Confirm Delete': '确认删除',
    });
    ctx.i18n.load('en', {
        'honor_main': 'Honor',
        'World Finals': 'World Finals',
        'ICPC Asia Regional': 'ICPC Asia Regional',
        'CCPC': 'CCPC',
        'Sichuan Provincial Contest': 'Sichuan Provincial Contest',
        'Team': 'Team',
        'Members': 'Members',
        'Award': 'Award',
        'Competition': 'Competition',
        'Venue': 'Venue',
        'Year': 'Year',
        'Session': 'Session',
        'Add Record': 'Add Record',
        'Edit': 'Edit',
        'Delete': 'Delete',
        'Save': 'Save',
        'Cancel': 'Cancel',
        'Confirm Delete': 'Confirm Delete',
    });
}
