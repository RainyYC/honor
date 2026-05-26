# honor

电子科技大学 ACM-ICPC 荣誉榜插件，适用于 [Hydro](https://github.com/hydro-dev/Hydro)。

收录世界总决赛、ICPC 亚洲区、CCPC、四川省赛四类赛事，共 602 条记录（2008–2026）。

## 功能

- **展示页** `/honor` — 四个标签页，按类别浏览所有荣誉记录
- **编辑页** `/honor/edit` — 需 `MOD_BADGE` 权限，支持增删改排序，全部 AJAX 操作无需刷新
- **行内编辑** — 直接在表格中修改队名、队员、奖项
- **排序** — ↑↓ 按钮调整记录顺序
- **国际化** — 中文/英文双语界面

## 安装

### 1. 复制插件到 Hydro 插件目录

```bash
# 上传到服务器
scp -r honor-plugin/ ubuntu@your-server:/tmp/honor/

# SSH 进入服务器，移动到 addons 目录
ssh ubuntu@your-server
sudo mv /tmp/honor /root/.hydro/addons/honor
```

⚠️ 目标路径必须与 Hydro 的 addons 目录一致。Hydro 以 root 身份通过 PM2 运行，路径取决于 `PM2_HOME`。可通过以下命令确认：

```bash
sudo PM2_HOME=/root/.pm2 pm2 info hydrooj | grep "cwd"
```

### 2. 注册插件

编辑 `/root/.hydro/addon.json`，添加一行：

```json
"/root/.hydro/addons/honor"
```

或者通过 Hydro 后台操作：**控制面板 → 插件 → 添加**，输入上述路径。

### 3. 重启 Hydro

```bash
sudo env PATH=/path/to/node/bin:/path/to/pm2/bin:$PATH \
  PM2_HOME=/root/.pm2 pm2 restart hydrooj
```

### 4. 验证

访问 `http://你的服务器/honor` 查看荣誉榜。  
访问 `http://你的服务器/honor/edit` 进入编辑页（需要 `MOD_BADGE` 权限用户登录）。

## 升级

```bash
# 上传新文件
scp index.ts templates/honor.html templates/honor_edit.html ubuntu@your-server:/tmp/
ssh ubuntu@your-server
sudo mv /tmp/index.ts /root/.hydro/addons/honor/
sudo mv /tmp/honor.html /root/.hydro/addons/honor/templates/
sudo mv /tmp/honor_edit.html /root/.hydro/addons/honor/templates/
sudo PM2_HOME=/root/.pm2 pm2 restart hydrooj
```

## 数据结构

数据存储在插件目录下的 `honor.json`，格式如下：

```json
{
  "source": "honor（截止2026年4月）.md",
  "institution": "电子科技大学 (UESTC)",
  "categories": [
    {
      "name": "世界总决赛",
      "type": "ICPC World Finals",
      "records": [
        {
          "team": "UESTC_Guest_WiFi",
          "competition": "2024 ACM-ICPC World Finals",
          "members": ["弋竞为", "朱铖昊", "汪澄"],
          "award": "第 51 名"
        }
      ]
    },
    {
      "name": "ICPC 亚洲区竞赛",
      "events": [
        {
          "year": "2025",
          "venues": [
            {
              "name": "EC-Final",
              "teams": [ ... ]
            }
          ]
        }
      ]
    }
  ]
}
```

更新数据可以直接编辑 `honor.json`，也可以通过 `/honor/edit` 页面操作（需要 `MOD_BADGE` 权限）。

## 权限

| 路由 | 权限 | 用途 |
|------|------|------|
| `/honor` | 公开 | 查看荣誉榜 |
| `/honor/edit` | `PRIV_MOD_BADGE` | 编辑页面 |
| `/honor/manage` | `PRIV_MOD_BADGE` | CRUD API（AJAX） |

## 文件结构

```
honor-plugin/
├── index.ts            # 插件入口：路由注册、Handler、CRUD API
├── package.json        # 插件元信息
├── honor.json          # 荣誉数据（602 条记录）
├── README.md
└── templates/
    ├── honor.html      # 公开展示页模板
    └── honor_edit.html # 编辑页模板（含 AJAX + 原生通知）
```

## 协议

AGPL-3.0-or-later，与 Hydro 一致。
