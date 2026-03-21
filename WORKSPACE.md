# WorkSpace 鈥斺€?宸ヤ綔绌洪棿

## 馃彔 浠€涔堟槸 WorkSpace锛?

WorkSpace 鏄粺涓€鐨勫伐浣滅┖闂村叆鍙ｏ紝璐熻矗锛?
1. 鍒涘缓鍜岀鐞?Team 鐨勭敓鍛藉懆鏈?
2. 鏍规嵁浠诲姟鏄惁甯︽湁 `teamId`锛屾櫤鑳借矾鐢卞埌鎸囧畾 Team 鎴?Agent
3. 杩斿洖 Team 鎴?Agent 瀹屾垚鐨勭粨鏋滅粰鐢ㄦ埛

### WorkSpace 鐨勬牳蹇冭亴璐?

```javascript
WorkSpace {
  // 1. Team 鐢熷懡鍛ㄦ湡绠＄悊
  createTeam(config)     // 鍒涘缓 Team
  destroyTeam(teamId)    // 閿€姣?Team
  initialize()           // 鍒濆鍖栫郴缁?

  // 2. 浠诲姟璺敱
  submitTask(task)       // 鎻愪氦浠诲姟锛堝甫 teamId 鈫?Team锛屼笉甯?鈫?Agent锛?

  // 3. Team 璁块棶鎺у埗
  enterTeam(teamId)      // 杩涘叆 Team
  exitTeam()             // 閫€鍑?Team
  listTeams()            // 鍒楀嚭鎵€鏈?Teams
}
```

### 浠诲姟璺敱閫昏緫

```
鐢ㄦ埛鎻愪氦浠诲姟
    鈹?
    鈹溾攢鈫?鏈?teamId锛?
    鈹?  鈹溾攢 鏄?鈫?浜ょ粰鎸囧畾 Team 鎵ц
    鈹?  鈹?        鈫?
    鈹?  鈹?     Team Leader 缁勭粐 Members 鍗忎綔
    鈹?  鈹?        鈫?
    鈹?  鈹?     杩斿洖缁撴灉
    鈹?  鈹?
    鈹?  鈹斺攢 鍚?鈫?浜ょ粰 Agent 鎵ц
    鈹?            鈫?
    鈹?         Agent 浣跨敤 Think-Act 妯″紡瀹屾垚
    鈹?            鈫?
    鈹?         杩斿洖缁撴灉
```

## 馃摑 浣跨敤绀轰緥

### 鍩虹鐢ㄦ硶

```javascript
import 'dotenv/config';
import { initLLM } from './llm.js';
import { WorkSpace } from './WorkSpace.js';

// 鍒濆鍖?LLM
initLLM();

// 鍒涘缓 WorkSpace
const workspace = new WorkSpace();
await workspace.initialize();

// 鍦烘櫙 1: 涓嶅甫 teamId 鐨勪换鍔★紙浜ょ粰 Agent锛?
const result1 = await workspace.submitTask('鐜板湪鍑犵偣浜嗭紵');
console.log(result1.executor); // 'Agent'
console.log(result1.result);   // 鎵ц缁撴灉

// 鍦烘櫙 2: 甯?teamId 鐨勪换鍔★紙浜ょ粰鎸囧畾 Team锛?
const result2 = await workspace.submitTask({
  description: '甯垜鍒楀嚭褰撳墠鐩綍鐨勬枃浠?,
  teamId: 'dev-team',
});
console.log(result2.executor); // 'Team'
console.log(result2.executorName); // 'dev-team'
console.log(result2.result);   // 鎵ц缁撴灉
```

### Team 鐢熷懡鍛ㄦ湡绠＄悊

```javascript
import { WorkSpace } from './WorkSpace.js';

const workspace = new WorkSpace();
await workspace.initialize();

// 1. 鍒涘缓鏂扮殑 Team
const newTeam = await workspace.createTeam({
  id: 'my-team',
  name: '鎴戠殑鍥㈤槦',
  description: '鐢ㄤ簬鐗瑰畾浠诲姟',
  Members: [
    {
      id: 'member-1',
      role: 'developer',
      skills: ['code-analysis', 'file-editing'],
    },
  ],
});

// 2. 浣跨敤 Team
await workspace.enterTeam('my-team');
const result = await workspace.submitTask('鍒嗘瀽浠ｇ爜缁撴瀯');

// 3. 閿€姣?Team
await workspace.destroyTeam('my-team');
```

### Team 璁块棶鎺у埗

```javascript
import { WorkSpace } from './WorkSpace.js';

const workspace = new WorkSpace();
await workspace.initialize();

// 鍒楀嚭鎵€鏈?Teams
workspace.listTeams();

// 杩涘叆 Team
await workspace.enterTeam('dev-team');

// 鍦?Team 鍐呮彁浜や换鍔?
const result = await workspace.submitTask({
  description: '璇诲彇 package.json',
  // 涓嶉渶瑕?teamId锛屼細鑷姩浣跨敤褰撳墠 Team
});

// 閫€鍑?Team
await workspace.exitTeam();
```

## 馃彈锔?鏋舵瀯璁捐

### 鏍稿績缁勪欢

```
WorkSpace锛堢粺涓€鍏ュ彛锛?
  鈹?
  鈹溾攢 Agent锛堝崟涓€鎵ц鑰咃級
  鈹?  鈹溾攢 Think-Act 妯″紡
  鈹?  鈹溾攢 鍩虹宸ュ叿锛坮ead, write, list, exec 绛夛級
  鈹?  鈹斺攢 鎵ц绠€鍗曚换鍔?
  鈹?
  鈹溾攢 Teams 绠＄悊
  鈹?  鈹溾攢 teams Map 鈥?鎵€鏈?Teams 鐨勯泦鍚?
  鈹?  鈹溾攢 currentTeamId 鈥?褰撳墠婵€娲荤殑 Team
  鈹?  鈹溾攢 enterTeam() / exitTeam() 鈥?Team 杩涘叆/閫€鍑?
  鈹?  鈹斺攢 createTeam() / destroyTeam() 鈥?Team 鐢熷懡鍛ㄦ湡
  鈹?
  鈹斺攢 Team锛堝崗浣滃洟闃燂級
      鈹溾攢 submitTask() - 浠诲姟鎻愪氦鍜屽崗璋?
      鈹溾攢 analyzeTask() - 鍒嗘瀽浠诲姟闇€姹?
      鈹溾攢 selectMembers() - 閫夋嫨鍚堥€傜殑 Members
      鈹斺攢 Members锛堟墽琛岃€咃級
           鈹溾攢 Member-1锛堣鑹诧細developer锛?
           鈹溾攢 Member-2锛堣鑹诧細researcher锛?
           鈹斺攢 ...
```

### 涓庢棫鏋舵瀯鐨勫姣?

**鏃ф灦鏋勶紙TeamLab锛夛細**
```
鐢ㄦ埛 鈫?TeamLab 鈫?(褰撳墠鍦?Team?)
                     鈹溾攢 鏄?鈫?Team Leader 鎵ц
                     鈹斺攢 鍚?鈫?Agent 鍐崇瓥
                              鈹溾攢 绠€鍗?鈫?鑷繁瀹屾垚
                              鈹斺攢 澶嶆潅 鈫?寤鸿杩涘叆 Team
```

**鏂版灦鏋勶紙WorkSpace锛夛細**
```
鐢ㄦ埛 鈫?WorkSpace 鈫?(浠诲姟鏈?teamId?)
                        鈹溾攢 鏄?鈫?鎸囧畾 Team 鎵ц
                        鈹斺攢 鍚?鈫?Agent 鎵ц
```

**鏀硅繘鐐癸細**
- 鉁?鏇存竻鏅扮殑璺敱閫昏緫锛氭樉寮忔寚瀹?`teamId` 鎴栭粯璁や娇鐢?Agent
- 鉁?鏇寸畝鍗曠殑鎺ュ彛锛氱粺涓€ `submitTask()` 鏂规硶
- 鉁?鏇村彲鎺х殑鎵ц锛氱敤鎴锋槑纭煡閬撲换鍔′細浜ょ粰璋佹墽琛?
- 鉁?淇濇寔鐏垫椿鎬э細鏀寔杩涘叆/閫€鍑?Team 鐨勪紶缁熸ā寮?

## 馃攧 浠诲姟澶勭悊娴佺▼

### 鍦烘櫙 1锛氫笉甯?teamId 鐨勪换鍔?

```
鐢ㄦ埛: workspace.submitTask('鐜板湪鍑犵偣浜嗭紵')
   鈫?
[WorkSpace 妫€娴嬶細娌℃湁 teamId]
   鈫?
[WorkSpace 璺敱锛氫氦缁?Agent]
   鈫?
[Agent 鎵ц锛歍hink-Act 妯″紡]
   鈹溾攢 Think: 鍒嗘瀽浠诲姟闇€姹?
   鈹溾攢 Act: 璋冪敤宸ュ叿鑾峰彇鏃堕棿
   鈹斺攢 杩斿洖缁撴灉
   鈫?
杩斿洖缁欑敤鎴?
{
  success: true,
  executor: 'Agent',
  executorName: 'WorkSpace Agent',
  result: '鐜板湪鏄?2026-03-21 21:06'
}
```

### 鍦烘櫙 2锛氬甫 teamId 鐨勪换鍔?

```
鐢ㄦ埛: workspace.submitTask({
  description: '鍒嗘瀽浠ｇ爜缁撴瀯',
  teamId: 'dev-team'
})
   鈫?
[WorkSpace 妫€娴嬶細鏈?teamId = 'dev-team']
   鈫?
[WorkSpace 璺敱锛氫氦缁?dev-team]
   鈫?
[Team Leader 鎺ユ敹浠诲姟]
   鈹溾攢 鍒嗘瀽浠诲姟闇€姹?
   鈹溾攢 閫夋嫨鍚堥€傜殑 Member
   鈹斺攢 缁勭粐 Members 鍗忎綔鎵ц
   鈫?
杩斿洖缁欑敤鎴?
{
  success: true,
  executor: 'Team',
  executorName: '寮€鍙戝洟闃?,
  teamId: 'dev-team',
  result: '浠ｇ爜缁撴瀯鍒嗘瀽缁撴灉...'
}
```

### 鍦烘櫙 3锛歍eam 涓嶅瓨鍦?

```
鐢ㄦ埛: workspace.submitTask({
  description: '鎵ц浠诲姟',
  teamId: 'non-existent-team'
})
   鈫?
[WorkSpace 妫€娴嬶細鏈?teamId = 'non-existent-team']
   鈫?
[WorkSpace 鏌ユ壘锛歍eam 涓嶅瓨鍦╙
   鈫?
杩斿洖閿欒淇℃伅
{
  success: false,
  error: '鉂?Team "non-existent-team" 涓嶅瓨鍦?,
  availableTeams: [
    { id: 'dev-team', name: '寮€鍙戝洟闃? },
    { id: 'research-team', name: '鐮旂┒鍥㈤槦' }
  ]
}
```

## 馃摝 API 鏂囨。

### WorkSpace 绫?

#### 鏋勯€犲嚱鏁?

```javascript
new WorkSpace(configPath = './src/Config.json')
```

- `configPath` - Team 閰嶇疆鏂囦欢璺緞锛堝彲閫夛級

#### 鏂规硶

##### `async initialize()`

鍒濆鍖?WorkSpace锛屽姞杞介厤缃苟鍒涘缓 Teams銆?

```javascript
await workspace.initialize();
```

##### `async submitTask(task)`

鎻愪氦浠诲姟锛堢粺涓€鎺ュ彛锛夈€?

**鍙傛暟锛?*
- `task` - 浠诲姟瀵硅薄鎴栦换鍔℃弿杩板瓧绗︿覆
  - `description` - 浠诲姟鎻忚堪锛堝鏋?`task` 鏄瓧绗︿覆锛屽垯鐩存帴浣跨敤锛?
  - `teamId` - 鎸囧畾 Team ID锛堝彲閫夛級

**杩斿洖鍊硷細**
```javascript
{
  success: boolean,
  executor: 'Agent' | 'Team',
  executorName: string,
  teamId?: string,
  result?: any,
  error?: string,
  availableTeams?: Array<{ id, name }>
}
```

**绀轰緥锛?*
```javascript
// 瀛楃涓插舰寮?
await workspace.submitTask('鐜板湪鍑犵偣浜嗭紵');

// 瀵硅薄褰㈠紡锛堜笉甯?teamId锛?
await workspace.submitTask({ description: '鍒嗘瀽浠ｇ爜' });

// 瀵硅薄褰㈠紡锛堝甫 teamId锛?
await workspace.submitTask({
  description: '鍒嗘瀽浠ｇ爜',
  teamId: 'dev-team'
});
```

##### `async createTeam(teamConfig)`

鍒涘缓鏂扮殑 Team銆?

**鍙傛暟锛?*
```javascript
{
  id: string,
  name: string,
  description: string,
  Members: Array<{
    id: string,
    role: string,
    skills: string[]
  }>
}
```

**杩斿洖鍊硷細** `Team` 瀹炰緥

##### `destroyTeam(teamId)`

閿€姣?Team銆?

**鍙傛暟锛?*
- `teamId` - Team ID

**杩斿洖鍊硷細** `boolean` - 鏄惁鎴愬姛

##### `async enterTeam(teamId)`

杩涘叆 Team銆?

**鍙傛暟锛?*
- `teamId` - Team ID

##### `async exitTeam()`

閫€鍑哄綋鍓?Team銆?

##### `listTeams()`

鍒楀嚭鎵€鏈?Teams銆?

##### `getAllTeams()`

鑾峰彇鎵€鏈?Teams銆?

**杩斿洖鍊硷細** `Array<Team>` - 鎵€鏈?Team 瀹炰緥

##### `getTeam(teamId)`

鑾峰彇鎸囧畾 Team銆?

**鍙傛暟锛?*
- `teamId` - Team ID

**杩斿洖鍊硷細** `Team | null` - Team 瀹炰緥

##### `getCurrentTeam()`

鑾峰彇褰撳墠娲昏穬 Team銆?

**杩斿洖鍊硷細** `Team | null` - 褰撳墠娲昏穬 Team 瀹炰緥

## 馃摝 鐩稿叧鏂囦欢

- `src/WorkSpace.js` - WorkSpace 鏍稿績瀹炵幇锛堝寘鍚?Teams 绠＄悊锛?
- `src/Agent.js` - Agent 鏍稿績瀹炵幇
- `src/Team.js` - Team 鏍稿績瀹炵幇
- `src/Member.js` - Member 鏍稿績瀹炵幇
- `src/Config.json` - 配置文件

## 馃殌 杩愯婕旂ず

```bash
# 杩愯 Team 绯荤粺婕旂ず
npm run demo:team
```

婕旂ず鍖呭惈澶氫釜鍦烘櫙锛?
1. 涓嶅甫 teamId 鐨勪换鍔★紙浜ょ粰 Agent锛?
2. 甯?teamId 鐨勪换鍔★紙浜ょ粰鎸囧畾 Team锛?
3. 杩涘叆 Team 鍚庢彁浜や换鍔?

## 馃搵 杩佺Щ鎸囧崡

### 浠?TeamLab 杩佺Щ鍒?WorkSpace

**鏃т唬鐮侊紙TeamLab锛夛細**
```javascript
import { TeamLab } from './TeamLab.js';

const teamSystem = new TeamLab();
await teamSystem.initialize();

// Team 澶栦换鍔?
const result1 = await teamSystem.submitTask('绠€鍗曚换鍔?);

// 杩涘叆 Team
await teamSystem.enterTeam('dev-team');

// Team 鍐呬换鍔?
const result2 = await teamSystem.submitTask('澶嶆潅浠诲姟');
```

**鏂颁唬鐮侊紙WorkSpace锛夛細**
```javascript
import { WorkSpace } from './WorkSpace.js';

const workspace = new WorkSpace();
await workspace.initialize();

// 浜ょ粰 Agent
const result1 = await workspace.submitTask('绠€鍗曚换鍔?);

// 浜ょ粰鎸囧畾 Team
const result2 = await workspace.submitTask({
  description: '澶嶆潅浠诲姟',
  teamId: 'dev-team'
});

// 鎴栬€呰繘鍏?Team 鍚庢彁浜?
await workspace.enterTeam('dev-team');
const result3 = await workspace.submitTask('澶嶆潅浠诲姟');
```

**涓昏鍙樺寲锛?*
1. `TeamLab` 鈫?`WorkSpace`
2. 鏄惧紡鎸囧畾 `teamId` 鎴栭粯璁や娇鐢?Agent
3. 杩斿洖缁撴灉鏍煎紡缁熶竴锛屽寘鍚?`executor` 鍜?`executorName`

## 馃幆 璁捐鍘熷垯

1. **鏄惧紡璺敱**锛氶€氳繃 `teamId` 鏄惧紡鎸囧畾鎵ц鑰咃紝閬垮厤妯＄硦鍐崇瓥
2. **绠€鍖栨帴鍙?*锛氱粺涓€ `submitTask()` 鏂规硶锛屾敮鎸佸瓧绗︿覆鍜屽璞′袱绉嶆牸寮?
3. **娓呮櫚鍙嶉**锛氳繑鍥炵粨鏋滃寘鍚墽琛岃€呬俊鎭紝鐢ㄦ埛鏄庣‘鐭ラ亾璋佹墽琛屼簡浠诲姟
4. **淇濇寔鍏煎**锛氭敮鎸佷紶缁熺殑杩涘叆/閫€鍑?Team 妯″紡
