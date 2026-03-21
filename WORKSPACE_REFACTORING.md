# TeamLab 鈫?WorkSpace 閲嶆瀯鎬荤粨

## 馃搮 閲嶆瀯鏃堕棿
2026-03-21

## 馃幆 閲嶆瀯鐩爣

灏?TeamLab 閲嶅懡鍚嶄负 WorkSpace锛屽苟閲嶆柊璁捐鍏惰亴璐ｏ細
1. 鍒涘缓鍜岀鐞?Team 鐨勭敓鍛藉懆鏈?
2. 鏍规嵁浠诲姟鏄惁甯︽湁 `teamId`锛屽喅瀹氫氦缁欐寚瀹?Team 鎴?Agent
3. 杩斿洖 Team 鎴?Agent 瀹屾垚鐨勭粨鏋滅粰鐢ㄦ埛

## 馃搵 涓昏鍙樻洿

### 1. 鏂囦欢鍙樻洿

**鏂板锛?*
- `src/WorkSpace.js` - WorkSpace 鏍稿績瀹炵幇
- `WORKSPACE.md` - WorkSpace 浣跨敤鏂囨。

**淇濈暀锛?*
- `src/Team.js` - Team 鏍稿績瀹炵幇锛堜笉鍙橈級
- `src/Member.js` - Member 鏍稿績瀹炵幇锛堜笉鍙橈級
- `src/TeamLeader.js` - Team 鍐呯殑 Leader锛堜笉鍙橈級
- `src/TeamRegistry.js` - Team 娉ㄥ唽鍜岀鐞嗭紙涓嶅彉锛?
- `src/Config.json` - 配置文件（不变）

**宸插垹闄わ細**
- `src/TeamLab.js` - 鏃х増鏈殑 Team 瀹為獙瀹わ紙宸茶縼绉昏嚦 WorkSpace锛?

### 2. WorkSpace 鐨勬牳蹇冭亴璐?

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

### 3. 浠诲姟璺敱閫昏緫

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

### 4. API 鍙樻洿

**鏃?API锛圱eamLab锛夛細**
```javascript
const teamSystem = new TeamLab();
await teamSystem.initialize();

// 鑷姩鍐崇瓥
const result = await teamSystem.submitTask('绠€鍗曚换鍔?);

// 杩涘叆 Team
await teamSystem.enterTeam('dev-team');

// Team 鍐呬换鍔?
const result2 = await teamSystem.submitTask('澶嶆潅浠诲姟');
```

**鏂?API锛圵orkSpace锛夛細**
```javascript
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

### 5. 杩斿洖缁撴灉鏍煎紡

**WorkSpace 缁熶竴杩斿洖鏍煎紡锛?*
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

## 鉁?鏀硅繘鐐?

1. **鏇存竻鏅扮殑璺敱閫昏緫**
   - 鏄惧紡鎸囧畾 `teamId` 鎴栭粯璁や娇鐢?Agent
   - 閬垮厤妯＄硦鐨勮嚜鍔ㄥ喅绛?

2. **鏇寸畝鍗曠殑鎺ュ彛**
   - 缁熶竴 `submitTask()` 鏂规硶
   - 鏀寔瀛楃涓插拰瀵硅薄涓ょ鏍煎紡

3. **鏇村彲鎺х殑鎵ц**
   - 鐢ㄦ埛鏄庣‘鐭ラ亾浠诲姟浼氫氦缁欒皝鎵ц
   - 杩斿洖缁撴灉鍖呭惈鎵ц鑰呬俊鎭?

4. **淇濇寔鍏煎**
   - 鏀寔浼犵粺鐨勮繘鍏?閫€鍑?Team 妯″紡
   - 淇濈暀 Team 鐨勬牳蹇冨姛鑳戒笉鍙?

## 馃摑 杩佺Щ鎸囧崡

### 浠?TeamLab 杩佺Щ鍒?WorkSpace

**鏃т唬鐮侊細**
```javascript
import { TeamLab } from './TeamLab.js';

const teamSystem = new TeamLab();
await teamSystem.initialize();

const result1 = await teamSystem.submitTask('绠€鍗曚换鍔?);
await teamSystem.enterTeam('dev-team');
const result2 = await teamSystem.submitTask('澶嶆潅浠诲姟');
```

**鏂颁唬鐮侊細**
```javascript
import { WorkSpace } from './WorkSpace.js';

const workspace = new WorkSpace();
await workspace.initialize();

const result1 = await workspace.submitTask('绠€鍗曚换鍔?);

// 鏂规硶 1: 鏄惧紡鎸囧畾 teamId
const result2 = await workspace.submitTask({
  description: '澶嶆潅浠诲姟',
  teamId: 'dev-team'
});

// 鏂规硶 2: 杩涘叆 Team 鍚庢彁浜?
await workspace.enterTeam('dev-team');
const result3 = await workspace.submitTask('澶嶆潅浠诲姟');
```

**涓昏鍙樺寲锛?*
1. `TeamLab` 鈫?`WorkSpace`
2. 鏄惧紡鎸囧畾 `teamId` 鎴栭粯璁や娇鐢?Agent
3. 杩斿洖缁撴灉鏍煎紡缁熶竴锛屽寘鍚?`executor` 鍜?`executorName`

## 馃摎 鐩稿叧鏂囨。

- [WORKSPACE.md](./WORKSPACE.md) - WorkSpace 浣跨敤鏂囨。
- [TEAM.md](./TEAM.md) - Team 浣跨敤鏂囨。
- [AGENT_OO_REFACTORING.md](./AGENT_OO_REFACTORING.md) - Agent 闈㈠悜瀵硅薄閲嶆瀯鏂囨。

## 馃И 娴嬭瘯

杩愯婕旂ず浠ラ獙璇佹柊鍔熻兘锛?

```bash
npm run demo:team
```

婕旂ず鍖呭惈浠ヤ笅鍦烘櫙锛?
1. 涓嶅甫 teamId 鐨勪换鍔★紙浜ょ粰 Agent锛?
2. 甯?teamId 鐨勪换鍔★紙浜ょ粰鎸囧畾 Team锛?
3. 杩涘叆 Team 鍚庢彁浜や换鍔?

## 馃帀 鎬荤粨

杩欐閲嶆瀯瀹炵幇浜嗕互涓嬬洰鏍囷細
- 鉁?灏?TeamLab 閲嶅懡鍚嶄负 WorkSpace
- 鉁?瀹炵幇浜嗗熀浜?`teamId` 鐨勬樉寮忎换鍔¤矾鐢?
- 鉁?缁熶竴浜嗘帴鍙ｅ拰杩斿洖鏍煎紡
- 鉁?淇濇寔浜嗗悜鍚庡吋瀹规€?
- 鉁?鎻愪緵浜嗗畬鏁寸殑鏂囨。鍜岀ず渚?

WorkSpace 鎻愪緵浜嗘洿娓呮櫚銆佹洿鍙帶鐨勪换鍔℃墽琛屾柟寮忥紝鍚屾椂淇濈暀浜?Team 绯荤粺鐨勭伒娲绘€у拰鍗忎綔鑳藉姏銆?
