# tmux Config Location in WSL2 Ubuntu

## Primary Location

The tmux configuration file is located at:
```bash
~/.tmux.conf
```

This expands to `/home/YOUR_USERNAME/.tmux.conf` in your WSL2 Ubuntu filesystem.

## Check if Config Exists

```bash
# Check if you have a config file
ls -la ~/.tmux.conf

# If it doesn't exist, you'll see:
# ls: cannot access '/home/username/.tmux.conf': No such file or directory
```

## Create Your Config

If the file doesn't exist (which is common for fresh installations), create it:

```bash
# Create the config file
touch ~/.tmux.conf

# Open it in your preferred editor
nano ~/.tmux.conf
# OR
vim ~/.tmux.conf
# OR
code ~/.tmux.conf  # Opens in VS Code if you have it set up
```

## Access from Windows

You can also access/edit this file from Windows:

### Method 1: Through Windows Explorer
```
\\wsl$\Ubuntu\home\YOUR_USERNAME\.tmux.conf
```
Or navigate to:
1. Open Windows Explorer
2. Type `\\wsl$` in the address bar
3. Navigate to `Ubuntu` → `home` → `YOUR_USERNAME`
4. Look for `.tmux.conf` (you may need to show hidden files)

### Method 2: Through VS Code
```bash
# From WSL2 terminal
code ~/.tmux.conf
```

### Method 3: Copy to Windows for editing
```bash
# Copy to Windows desktop
cp ~/.tmux.conf /mnt/c/Users/YOUR_WINDOWS_USERNAME/Desktop/tmux.conf

# Edit it in Windows, then copy back
cp /mnt/c/Users/YOUR_WINDOWS_USERNAME/Desktop/tmux.conf ~/.tmux.conf
```

## Apply Configuration Changes

After creating or modifying your config:

```bash
# If tmux is running, reload the config:
tmux source-file ~/.tmux.conf

# Or use the shortcut if you've configured one (usually prefix + r)
# Default would be: Ctrl+b, then r
```

## Verify Config is Loaded

```bash
# Start tmux
tmux

# Check if your settings are applied
tmux show-options -g | grep mouse
# Should show "mouse on" if you've enabled it

# List all current settings
tmux show-options -g
```

## Quick Setup Script

Here's a quick script to create a basic Windows-friendly config:

```bash
# Create a basic tmux config for Windows users
cat > ~/.tmux.conf << 'EOF'
# Enable mouse support
set -g mouse on

# Start windows and panes at 1
set -g base-index 1
setw -g pane-base-index 1

# Use Alt+arrow to switch panes
bind -n M-Left select-pane -L
bind -n M-Right select-pane -R
bind -n M-Up select-pane -U
bind -n M-Down select-pane -D

# Shift+arrow to switch windows
bind -n S-Left previous-window
bind -n S-Right next-window

# Better scrolling
bind -n WheelUpPane if-shell -F -t = "#{mouse_any_flag}" "send-keys -M" "if -Ft= '#{pane_in_mode}' 'send-keys -M' 'copy-mode -e'"

# Reload config with prefix + r
bind r source-file ~/.tmux.conf \; display "Config reloaded!"
EOF

echo "tmux config created at ~/.tmux.conf"
echo "Start tmux and the mouse should work!"
```

## Troubleshooting

### Config not loading?
```bash
# Check for syntax errors
tmux source-file ~/.tmux.conf
# It will show errors if there are any

# Make sure file permissions are correct
chmod 644 ~/.tmux.conf
```

### Can't see .tmux.conf in Windows Explorer?
- Windows Explorer hides files starting with `.` by default
- Go to View → Show → Hidden items (Windows 11)
- Or View → Hidden items (Windows 10)

### Want to use a different location?
```bash
# You can specify a custom config file when starting tmux
tmux -f /path/to/your/config.conf
```

## System-wide Config (Alternative)

There's also a system-wide config location, but it's rarely used:
```bash
/etc/tmux.conf
```

The user config (`~/.tmux.conf`) always takes precedence over the system-wide config.

## Next Steps

1. Create the file: `touch ~/.tmux.conf`
2. Add the Windows-friendly configuration from my previous message
3. Reload tmux: `tmux source-file ~/.tmux.conf`
4. Test that mouse scrolling works!

Your Claude Code scrolling issue should be resolved once you enable mouse support in the config!