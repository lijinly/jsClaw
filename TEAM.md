# Team 鈥斺€?鍗忎綔鍥㈤槦

## 馃彔 浠€涔堟槸 Team锛?

Team 鏄竴涓寔涔呭寲鐨勫崗浣滃洟闃燂紝鍦ㄨ繖閲屽彲浠ュ父椹讳竴缁?Member銆佷竴涓?Leader 鍜屼綘銆?

### Team 鐨勬牳蹇冩蹇?

1. **Team锛堝洟闃燂級** - 鎸佷箙鍖栫殑宸ヤ綔鐜锛屼笓闂ㄥ鐞嗘煇涓€绫讳换鍔?
2. **Member锛堟垚鍛橈級** - 鍏锋湁鐗瑰畾鎶€鑳界粍鐨?Agent
3. **Leader锛堥槦闀匡級** - Team 鐨勭紪鎺掕€咃紝璐熻矗锛?
   - 鍦?Team 鍐咃細鎺ユ敹浠诲姟 鈫?缁勭粐 Members 鎵ц 鈫?杈撳嚭缁撴灉
   - 鍦?Team 澶栵細鎺ユ敹浠诲姟 鈫?鍐冲畾鑷繁瀹屾垚鎴栧紩瀵肩敤鎴疯繘鍏?Team

### Team 鐨勮璁＄悊蹇?

```
浼犵粺妯″紡锛?
鐢ㄦ埛 鈫?Leader 鈫?Member
锛堝崟涓€璺緞锛屾墍鏈変换鍔￠兘璧板悓涓€濂楁祦绋嬶級

WorkSpace 妯″紡锛?
鐢ㄦ埛
  鈹溾攢鈫?涓嶅甫 teamId 鐨勪换鍔?鈫?Agent 瀹屾垚
  鈹?
  鈹斺攢鈫?甯?teamId 鐨勪换鍔?鈫?Team 缁勭粐 Members 鈫?Members 鎵ц
```

## 馃幆 Team 鐨勪紭鍔?

### 1. **浠诲姟鍒嗙被鏇存竻鏅?*
- 姣忎釜 Team 涓撴敞浜庣壒瀹氶鍩燂紙寮€鍙戙€佺爺绌躲€佹祴璇曠瓑锛?
- Members 鍦?Team 涓湁鏄庣‘鐨勮亴璐ｅ垎宸?

### 2. **璧勬簮鍒╃敤鏇撮珮鏁?*
- 涓嶅甫 teamId 鐨勭畝鍗曚换鍔★細Agent 鐩存帴瀹屾垚
- 甯?teamId 鐨勪换鍔★細涓撻棬浼樺寲鐨?Members 鍗忎綔鎵ц

### 3. **鍗忎綔鏇寸伒娲?*
- 鍙互澶氫釜 Team 骞跺瓨锛岄拡瀵逛笉鍚屼换鍔＄被鍨?
- 鐢ㄦ埛鍙互鑷敱杩涘叆鍜岄€€鍑?Team
- Leader 鏅鸿兘鍒ゆ柇搴旇鍦ㄥ摢閲屽畬鎴愪换鍔?

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

// 涓嶅甫 teamId 鐨勪换鍔★紙浜ょ粰 Agent锛?
const result1 = await workspace.submitTask('鐜板湪鍑犵偣浜嗭紵');
console.log(result1.executor); // 'Agent'

// 甯?teamId 鐨勪换鍔★紙浜ょ粰鎸囧畾 Team锛?
const result2 = await workspace.submitTask({
  description: '甯垜鍒嗘瀽椤圭洰浠ｇ爜缁撴瀯',
  teamId: 'dev-team',
});
console.log(result2.executor); // 'Team'

// 鎴栬繘鍏?Team 鍚庢彁浜?
await workspace.enterTeam('dev-team');

// Team 鍐呮彁浜や换鍔★紙Members 鍗忎綔锛?
const result3 = await workspace.submitTask('璇诲彇骞跺垎鏋?package.json');
// 鈫?Team Leader 缁勭粐 Members 鎵ц

// 閫€鍑?Team
await workspace.exitTeam();
```

### 鑷畾涔?Team 閰嶇疆

鍦?`src/Config.json` 涓畾涔?Teams锛?

```json
{
  "teams": {
    "my-team": {
      "id": "my-team",
      "name": "鎴戠殑鍥㈤槦",
      "description": "鐢ㄤ簬鐗瑰畾浠诲姟",
      "Members": [
        {
          "id": "member-1",
          "role": "developer",
          "skills": ["code-analysis", "file-editing"]
        }
      ]
    }
  }
}
```

## 馃彈锔?鏋舵瀯璁捐

### 鏍稿績缁勪欢

```
WorkSpace锛堢郴缁熷叆鍙ｏ級
  鈹?
  鈹溾攢 Teams 绠＄悊
  鈹?   鈹溾攢 teams Map 鈥?鎵€鏈?Teams 鐨勯泦鍚?
  鈹?   鈹溾攢 currentTeamId 鈥?褰撳墠婵€娲荤殑 Team
  鈹?   鈹溾攢 enterTeam() / exitTeam() 鈥?Team 杩涘叆/閫€鍑?
  鈹?   鈹斺攢 createTeam() / destroyTeam() 鈥?Team 鐢熷懡鍛ㄦ湡
  鈹?
  鈹溾攢 浠诲姟璺敱
  鈹?   鈹溾攢 submitTask(task) 鈥?缁熶竴浠诲姟鎻愪氦
  鈹?   鈹溾攢 handleTaskWithAgent() 鈥?涓嶅甫 teamId 鈫?Agent
  鈹?   鈹斺攢 handleTaskWithTeam() 鈥?甯?teamId 鈫?Team
  鈹?
  鈹斺攢 Team锛堝洟闃燂級
  鈹?   鈹溾攢 submitTask() - 浠诲姟鎻愪氦鍜屽崗璋?
  鈹?   鈹溾攢 analyzeTask() - 鍒嗘瀽浠诲姟闇€姹?
  鈹?   鈹溾攢 selectMembers() - 閫夋嫨鍚堥€傜殑 Members
  鈹?   鈹斺攢 Members锛堟墽琛岃€咃級
  鈹?        鈹溾攢 Member-1锛堣鑹诧細developer锛?
  鈹?        鈹溾攢 Member-2锛堣鑹诧細researcher锛?
  鈹?        鈹斺攢 ...
```

### Member 鐨勬妧鑳戒綋绯?

```
Member
  鈹?
  鈹溾攢 鍩虹鎶€鑳斤紙绯荤粺鍐呯疆锛屾墍鏈?Member 鍏变韩锛?
  鈹?   鈹溾攢 read, write, list, edit
  鈹?   鈹溾攢 exec, web_search, web_fetch
  鈹?   鈹斺攢 browser, message
  鈹?
  鈹斺攢 瑙掕壊鎶€鑳斤紙鍔ㄦ€佸姞杞斤紝鏍规嵁 Member 瑙掕壊锛?
       鈹溾攢 code-analysis锛堝紑鍙戣€?Member锛?
       鈹溾攢 data-analysis锛堢爺绌惰€?Member锛?
       鈹斺攢 ...
```

## 馃攧 浠诲姟澶勭悊娴佺▼

### 鍦烘櫙 1锛歍eam 澶栫畝鍗曚换鍔?

```
鐢ㄦ埛鎻愪氦浠诲姟锛圱eam 澶栵級
   鈫?
[TeamLeader 鎺ユ敹]
   鈫?
鍒嗘瀽浠诲姟锛氱畝鍗曚换鍔★紝鏃犻渶鐗规畩鎶€鑳?
   鈫?
Leader 鑷繁瀹屾垚
   鈫?
杩斿洖缁撴灉
```

### 鍦烘櫙 2锛歐orkSpace 璺敱鍒?Team

```
鐢ㄦ埛鎻愪氦浠诲姟锛堝甫 teamId锛?
   鈫?
[WorkSpace 鎺ユ敹]
   鈫?
浠诲姟璺敱锛氭湁 teamId 鈫?浜ょ粰鎸囧畾 Team
   鈫?
[Team.submitTask()]
   鈫?
鍒嗘瀽浠诲姟闇€姹傦紙闇€瑕侊細read, exec, code-analysis锛?
   鈫?
閫夋嫨鍚堥€傜殑 Members锛圖eveloper锛?
   鈫?
Member.execute()
   鈫?
杩斿洖缁撴灉
```
```

### 鍦烘櫙 3锛歍eam 鍐呬换鍔?

```
鐢ㄦ埛鎻愪氦浠诲姟锛圱eam 鍐咃級
   鈫?
[Team.submitTask()]
   鈫?
鍒嗘瀽浠诲姟闇€姹?
   鈫?
閫夋嫨鍚堥€傜殑 Member锛堟垨澶氫釜 Members 鍗忎綔锛?
   鈫?
Members 鎵ц浠诲姟
   鈫?
杩斿洖缁撴灉
```

## 馃摝 鐩稿叧鏂囦欢

- `src/Team.js` - Team 鏍稿績瀹炵幇
- `src/Member.js` - Member 鏍稿績瀹炵幇
- `src/WorkSpace.js` - WorkSpace 宸ヤ綔绌洪棿锛堝寘鍚?Teams 绠＄悊锛?
- `src/Config.json` - 配置文件

## 馃殌 杩愯婕旂ず

```bash
# 杩愯 Team 绯荤粺婕旂ず
npm run demo:team
```

婕旂ず鍖呭惈澶氫釜鍦烘櫙锛?
1. Team 澶栨彁浜ょ畝鍗曚换鍔?
2. Team 澶栨彁浜ゅ鏉備换鍔★紙寤鸿杩涘叆 Team锛?
3. 杩涘叆 Team
4. Team 鍐呮彁浜や换鍔?
5. 閫€鍑?Team
