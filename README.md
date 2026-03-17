# 抖音桌面端 真全屏补丁

将抖音 Windows 桌面客户端调整为更接近纯播放器的沉浸式全屏模式，尽量隐藏播放无关 UI，仅保留视频主体与弹幕。

![Windows](https://img.shields.io/badge/平台-Windows-0078d4) ![Douyin](https://img.shields.io/badge/抖音桌面端-7.4.x~7.5.x-fe2c55)

## 效果

- 🎬 **真全屏** — 视频区域扩展到全屏显示；竖屏视频优先保持完整画面，不强制裁切
- 🧹 **UI 隐藏** — 右侧互动按钮、底部作者信息、搜索栏、推荐栏、播放器控件默认隐藏
- 💬 **保留弹幕** — 默认保留弹幕，其余覆盖层尽量隐藏
- 🖱️ **自动隐藏光标** — 2.5 秒无操作后光标和切换按钮自动淡出
- ⌨️ **快捷键** — `F` 切换全屏 / `Escape` 退出

## 文件说明

| 文件 | 用途 |
|------|------|
| `fullscreen_payload.js` | 核心注入脚本，包含 CSS + JS 全部逻辑 |
| `patch_preload.ps1` | **首次注入**：自动查找最新版抖音目录；若当前文件尚未打补丁，会先创建版本绑定备份再注入 |
| `apply_preload_patch.ps1` | **热更新**：只替换已注入的 payload 部分，无需重新备份 |
| `patch_douyin.ps1` | **ASAR 方式**：解包 app.asar → 注入 → 重新打包（需要 npm/npx，重复执行不会叠加注入） |

## 使用方法

### 方式一：preload.js 直接注入（推荐）

抖音 7.4.x ~ 7.5.x 版本中，`app.asar.unpacked/preload.js` 可以直接修改，无需先解包 ASAR。

1. **关闭抖音**（包括守护进程）
2. **首次注入**（需管理员权限）
   ```powershell
   # 首次运行会自动创建版本绑定备份，例如：
   # C:\temp\douyin_patch_work\preload_original_7.4.0.js
   powershell -ExecutionPolicy Bypass -File patch_preload.ps1
   ```
3. **如果你已经提前手动备份过原始 preload.js，也可以显式指定备份路径**
   ```powershell
   powershell -ExecutionPolicy Bypass -File patch_preload.ps1 -BackupPath "C:\path\to\preload_original.js"
   ```
4. **启动抖音** → 按 `F` 进入真全屏

### 方式二：ASAR 解包注入

适用于 preload.js 不在 unpacked 目录的旧版本。

```powershell
# 需要 Node.js / npx
powershell -ExecutionPolicy Bypass -File patch_douyin.ps1
# 按提示替换 app.asar 后重启抖音
```

`patch_douyin.ps1` 现在会检测已存在的补丁标记。重复运行时会替换旧 payload，而不是重复追加多份；同时会校验 `asar extract/pack` 是否执行成功。

### 后续更新 Payload

修改 `fullscreen_payload.js` 后，无需重新备份：

```powershell
# 关闭抖音
powershell -ExecutionPolicy Bypass -File apply_preload_patch.ps1
# 重启抖音
```

以上三个脚本默认都会从仓库当前目录读取 `fullscreen_payload.js`，clone 后无需再手动复制到 `C:\temp\douyin_patch\`。

## 技术原理

- 通过修改 Electron 的 `preload.js`，在渲染进程加载时注入自定义脚本
- CSS `!important` 规则覆盖抖音内联样式，强制全屏布局
- `MutationObserver` 监听 DOM 变化，切换视频时自动重新应用样式
- `setInterval` 每 500ms 强制覆盖抖音 JS 动态设置的内联 style
- `requestAnimationFrame` 帧循环 + `elementFromPoint` 探测动态生成的浮层（搜索栏、推荐按钮等）
- 退出全屏时完整还原所有修改，不留副作用

## 注意事项

- ⚠️ 抖音更新后可能需要重新注入（版本目录路径会变）
- ⚠️ 需要管理员权限修改 Program Files 下的文件
- ⚠️ 已在 Windows 抖音桌面端 7.4.x ~ 7.5.x 上测试
- 本项目仅用于个人使用体验优化，不涉及任何数据抓取或破解行为

## License

[MIT](LICENSE)
