// 用 pythonw.exe（Windows GUI 子系统 Python，无 console 窗口）
// 避免 PM2 每次启动/重启都弹出 cmd 窗口
module.exports = {
  apps: [
    {
      name: 'douyin-patch-watcher',
      script: 'C:/Users/kensei/scoop/apps/python312/current/pythonw.exe',
      args: 'douyin_patch_watcher.py',
      cwd: 'F:/claude/longterm/douyin-fullscreen-patch',
      interpreter: 'none',
      windowsHide: true,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      min_uptime: '30s',
      max_memory_restart: '200M',
      out_file: 'F:/claude/logs/douyin-patch-watcher.pm2.out.log',
      error_file: 'F:/claude/logs/douyin-patch-watcher.pm2.err.log',
      merge_logs: true,
      time: true,
    },
  ],
};
