# tmux Configuration for Windows GUI Users

## Key Philosophy for Windows Users

Windows users are accustomed to:
- **Ctrl+C/V/X** for copy/paste
- **Shift+Arrows** for selection
- **Ctrl+Shift+C/V** in terminals
- **Alt+Tab** for window switching
- **Ctrl+Arrow** for word jumping
- Mouse-first interactions

Here's a Windows-friendly tmux configuration:

## Complete Windows-Optimized Configuration

```bash
# ~/.tmux.conf - Windows-friendly configuration

# ==========================================
# GENERAL SETTINGS
# ==========================================

# Use Ctrl+Space as prefix (less conflict with Windows shortcuts)
unbind C-b
set -g prefix C-Space
bind C-Space send-prefix

# Alternative: Use Alt+a as prefix (even less conflict)
# set -g prefix M-a
# bind M-a send-prefix

# Enable true color support
set -g default-terminal "screen-256color"
set -ag terminal-overrides ",xterm-256color:RGB"

# Basic settings
set -g history-limit 50000
set -g display-time 4000
set -g status-interval 5
set -sg escape-time 0
set -g focus-events on

# Windows-like numbering (start at 1)
set -g base-index 1
setw -g pane-base-index 1
set -g renumber-windows on

# ==========================================
# MOUSE SUPPORT (ESSENTIAL FOR WINDOWS USERS)
# ==========================================

# Full mouse support
set -g mouse on

# Allow mouse wheel scrolling
bind -n WheelUpPane if-shell -F -t = "#{mouse_any_flag}" "send-keys -M" "if -Ft= '#{pane_in_mode}' 'send-keys -M' 'select-pane -t=; copy-mode -e; send-keys -M'"
bind -n WheelDownPane select-pane -t= \; send-keys -M

# Click to select windows and panes
bind -n MouseDown1Pane select-pane -t= \; send-keys -M
bind -n MouseDown1Status select-window -t=

# Drag to resize panes
bind -n MouseDrag1Border resize-pane -M

# Right-click for context menu feel
bind -n MouseDown3Pane display-menu -T "Tmux" -x M -y M \
    "Copy Mode" c "copy-mode" \
    "Paste" p "paste-buffer" \
    "━━━━━━━━━━" "" "" \
    "New Window" n "new-window" \
    "Split Horizontal" h "split-window -h" \
    "Split Vertical" v "split-window -v" \
    "━━━━━━━━━━" "" "" \
    "Kill Pane" x "kill-pane" \
    "Kill Window" X "kill-window"

# ==========================================
# WINDOWS-STYLE COPY/PASTE
# ==========================================

# Use Windows clipboard
if-shell "command -v clip.exe" \
    "bind -T copy-mode-vi Enter send-keys -X copy-pipe-and-cancel 'clip.exe'"

# Copy mode with familiar keys
setw -g mode-keys vi

# Enter copy mode with Ctrl+Shift+C (mimics terminal behavior)
bind -n C-S-c copy-mode

# Windows-style selection and copy
bind -T copy-mode-vi C-c send-keys -X copy-pipe-and-cancel "clip.exe"
bind -T copy-mode-vi MouseDragEnd1Pane send-keys -X copy-pipe-and-cancel "clip.exe"

# Ctrl+V to paste (when in tmux command mode)
bind C-v run "powershell.exe -command 'Get-Clipboard' | tmux load-buffer - ; tmux paste-buffer"

# Shift+Insert to paste (traditional Windows terminal)
bind -n S-IC paste-buffer

# ==========================================
# WINDOWS-STYLE WINDOW/PANE MANAGEMENT
# ==========================================

# Alt+Number to switch windows (like browser tabs)
bind -n M-1 select-window -t 1
bind -n M-2 select-window -t 2
bind -n M-3 select-window -t 3
bind -n M-4 select-window -t 4
bind -n M-5 select-window -t 5
bind -n M-6 select-window -t 6
bind -n M-7 select-window -t 7
bind -n M-8 select-window -t 8
bind -n M-9 select-window -t 9

# Ctrl+T for new window (like browser)
bind -n C-t new-window -c "#{pane_current_path}"

# Ctrl+W to close pane/window (like browser tab)
bind -n C-w kill-pane

# Ctrl+Tab / Ctrl+Shift+Tab to cycle windows (like browser)
bind -n C-Tab next-window
bind -n C-S-Tab previous-window

# Alt+Arrow to switch panes (like Windows Snap)
bind -n M-Left select-pane -L
bind -n M-Right select-pane -R
bind -n M-Up select-pane -U
bind -n M-Down select-pane -D

# Ctrl+Shift+Arrow to resize panes (like some Windows apps)
bind -n C-S-Left resize-pane -L 5
bind -n C-S-Right resize-pane -R 5
bind -n C-S-Up resize-pane -U 5
bind -n C-S-Down resize-pane -D 5

# ==========================================
# SPLITTING (WINDOWS STYLE)
# ==========================================

# Ctrl+Shift+N for new window (like Windows Terminal)
bind -n C-S-n new-window -c "#{pane_current_path}"

# Alt+Shift+- for horizontal split (like Windows Terminal)
bind -n M-S-- split-window -v -c "#{pane_current_path}"

# Alt+Shift+| for vertical split (like Windows Terminal)
bind -n M-S-\\ split-window -h -c "#{pane_current_path}"

# Alternative: Ctrl+Shift+D to duplicate/split (like VS Code)
bind -n C-S-d split-window -h -c "#{pane_current_path}"

# ==========================================
# FUNCTION KEY BINDINGS (FAMILIAR TO WINDOWS)
# ==========================================

# F1 - Help
bind -n F1 list-keys

# F2 - Rename window (like Windows rename)
bind -n F2 command-prompt -I "#W" "rename-window '%%'"

# F3 - Search (enter copy mode for searching)
bind -n F3 copy-mode \; command-prompt -p "(search up)" "send -X search-backward '%%'"

# F4 - Close (Alt+F4 feeling)
bind -n F4 confirm-before -p "Close window #W? (y/n)" kill-window

# F5 - Reload config (like browser refresh)
bind -n F5 source-file ~/.tmux.conf \; display-message "Config reloaded!"

# F11 - Zoom pane (like fullscreen)
bind -n F11 resize-pane -Z

# ==========================================
# STATUS BAR (WINDOWS TASKBAR STYLE)
# ==========================================

set -g status on
set -g status-position bottom
set -g status-justify left
set -g status-style 'bg=colour17 fg=colour15'  # Windows blue theme

# Left side - Start button feel
set -g status-left-length 30
set -g status-left '#[bg=colour19,fg=colour15,bold] ⊞ TMUX #[bg=colour17] #S '

# Right side - System tray feel
set -g status-right-length 60
set -g status-right '#[bg=colour19] 🔔 #(whoami) #[bg=colour21] 📅 %m/%d/%Y #[bg=colour19] 🕐 %I:%M %p '

# Window tabs - Windows taskbar style
setw -g window-status-separator ''
setw -g window-status-format '#[bg=colour18,fg=colour248] #I: #W '
setw -g window-status-current-format '#[bg=colour39,fg=colour15,bold] #I: #W #F '
setw -g window-status-activity-style 'bg=colour202,fg=colour15,bold'

# ==========================================
# PANE BORDERS (WINDOWS STYLE)
# ==========================================

set -g pane-border-style 'fg=colour240'
set -g pane-active-border-style 'fg=colour39 bg=default'
set -g pane-border-lines heavy  # Thicker borders like Windows

# ==========================================
# NOTIFICATIONS (WINDOWS STYLE)
# ==========================================

set -g visual-activity on
set -g visual-bell on
set -g visual-silence off
setw -g monitor-activity on
set -g bell-action any

# ==========================================
# QUICK COMMANDS (WINDOWS SHORTCUTS)
# ==========================================

# Ctrl+Q to quit session (like many Windows apps)
bind -n C-q confirm-before -p "Quit tmux session? (y/n)" kill-session

# Ctrl+O to open new window with file explorer
bind -n C-o new-window "explorer.exe ."

# Ctrl+P for command palette (like VS Code)
bind -n C-p command-prompt

# ==========================================
# SCROLLING IMPROVEMENTS
# ==========================================

# Page Up/Down for scrolling (Windows standard)
bind -n PPage copy-mode -e \; send-keys -X page-up
bind -n NPage copy-mode -e \; send-keys -X page-down

# Shift+Page Up/Down for faster scrolling
bind -n S-PPage copy-mode -e \; send-keys -X halfpage-up
bind -n S-NPage copy-mode -e \; send-keys -X halfpage-down

# Home/End keys
bind -n Home copy-mode -e \; send-keys -X history-top
bind -n End copy-mode -e \; send-keys -X history-bottom
```

## Minimal Windows-Friendly Config

If the above is too complex, here's a minimal config:

```bash
# ~/.tmux.conf - Minimal Windows-friendly config

# Enable mouse for everything
set -g mouse on

# Windows-like copy/paste
setw -g mode-keys vi
bind -T copy-mode-vi Enter send-keys -X copy-pipe-and-cancel "clip.exe"
bind -T copy-mode-vi MouseDragEnd1Pane send-keys -X copy-pipe-and-cancel "clip.exe"

# Alt+Number to switch windows
bind -n M-1 select-window -t 1
bind -n M-2 select-window -t 2
bind -n M-3 select-window -t 3
bind -n M-4 select-window -t 4
bind -n M-5 select-window -t 5

# Alt+Arrow to switch panes
bind -n M-Left select-pane -L
bind -n M-Right select-pane -R
bind -n M-Up select-pane -U
bind -n M-Down select-pane -D

# Ctrl+T for new window
bind -n C-t new-window

# F11 to zoom (fullscreen) pane
bind -n F11 resize-pane -Z

# Start numbering at 1
set -g base-index 1
set -g pane-base-index 1
```

## Key Mapping Reference for Windows Users

| Windows Habit | tmux Equivalent | Config Line |
|--------------|-----------------|-------------|
| Ctrl+C (Copy) | Ctrl+Shift+C | `bind -n C-S-c copy-mode` |
| Ctrl+V (Paste) | Ctrl+V | `bind C-v run "powershell.exe -command 'Get-Clipboard'"` |
| Alt+Tab | Alt+Number | `bind -n M-1 select-window -t 1` |
| Ctrl+T (New Tab) | Ctrl+T | `bind -n C-t new-window` |
| Ctrl+W (Close) | Ctrl+W | `bind -n C-w kill-pane` |
| F11 (Fullscreen) | F11 | `bind -n F11 resize-pane -Z` |
| Mouse Select | Mouse | `set -g mouse on` |

## Windows Terminal Integration

If using Windows Terminal, add these settings to your Windows Terminal `settings.json`:

```json
{
    "profiles": {
        "defaults": {
            // Send input straight to tmux
            "commandline": "wsl.exe ~ -e tmux",
            
            // Windows-friendly key bindings
            "actions": [
                { "command": "copy", "keys": "ctrl+shift+c" },
                { "command": "paste", "keys": "ctrl+shift+v" },
                { "command": "newTab", "keys": "ctrl+t" },
                { "command": "closeTab", "keys": "ctrl+w" }
            ]
        }
    },
    
    // Enable mouse support
    "experimental.detectURLs": true,
    "copyOnSelect": true
}
```

## Tips for Windows Users

1. **Mouse is your friend**: Unlike traditional tmux users, embrace the mouse
2. **Use Alt instead of Ctrl**: Avoids conflicts with Windows shortcuts
3. **Function keys**: F-keys are rarely used in terminals, perfect for tmux
4. **Right-click menu**: The config includes a context menu for discoverability
5. **Clipboard integration**: The config automatically uses Windows clipboard
6. **Visual feedback**: Windows users expect visual notifications - they're enabled

This configuration makes tmux feel more like a native Windows application while maintaining its power and flexibility!