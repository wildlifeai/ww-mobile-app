> You seem to been having timeouts installing things. tell me what to install and I will do so manually and also what to check for each. I will repot back once all done and then you can
   check it and then we can continue.

● Perfect! Let's take a systematic approach. I'll give you the exact commands to run manually and what to check for each step.

  Manual Installation Steps

  Step 1: Node.js Version (CRITICAL)

  # Check current version
  node --version

  # If not v20.x.x, install Node 20
  nvm install 20
  nvm use 20
  nvm alias default 20

  # Verify
  node --version  # Should show v20.x.x
  What to check: Node version should be v20.x.x (not v22.x.x)

  Step 2: React Native CLI

  # Install the React Native CLI globally
  npm install -g @react-native-community/cli

  # Verify installation
  npx react-native --version
  What to check: Should show React Native CLI version without errors

  Step 3: Java Development Kit (Required for Android)

  # Install OpenJDK 11
  sudo apt update
  sudo apt install -y openjdk-11-jdk

  # Set JAVA_HOME
  echo 'export JAVA_HOME=/usr/lib/jvm/java-11-openjdk-amd64' >> ~/.bashrc
  source ~/.bashrc

  # Verify
  java -version
  echo $JAVA_HOME
  What to check:
  - Java version should show openjdk version "11.x.x"
  - $JAVA_HOME should print the Java path

  Step 4: Android SDK (Required for Android)

  # Create Android SDK directory
  mkdir -p ~/Android/Sdk

  # Download Android command line tools
  cd ~/Android/Sdk
  wget https://dl.google.com/android/repository/commandlinetools-linux-9477386_latest.zip
  unzip commandlinetools-linux-9477386_latest.zip

  # Set up command line tools
  mkdir -p cmdline-tools/latest
  mv cmdline-tools/* cmdline-tools/latest/ 2>/dev/null || true

  # Set environment variables
  echo 'export ANDROID_HOME=~/Android/Sdk' >> ~/.bashrc
  echo 'export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin' >> ~/.bashrc
  echo 'export PATH=$PATH:$ANDROID_HOME/platform-tools' >> ~/.bashrc
  source ~/.bashrc

  # Install SDK components (CORRECTED VERSIONS)
  yes | sdkmanager --licenses
  sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"
  sdkmanager "platforms;android-33" "build-tools;33.0.0"
  What to check:
  - echo $ANDROID_HOME should print the Android SDK path
  - sdkmanager --list should show installed packages

  Step 5: Ruby (Required for iOS)

  # Install Ruby dependencies
  sudo apt install -y autoconf bison build-essential libssl-dev libyaml-dev libreadline6-dev zlib1g-dev libncurses5-dev libffi-dev libgdbm6 libgdbm-dev libdb-dev

  # Install rbenv
  git clone https://github.com/rbenv/rbenv.git ~/.rbenv
  echo 'export PATH="$HOME/.rbenv/bin:$PATH"' >> ~/.bashrc
  echo 'eval "$(rbenv init -)"' >> ~/.bashrc
  source ~/.bashrc

  # Install ruby-build
  git clone https://github.com/rbenv/ruby-build.git ~/.rbenv/plugins/ruby-build

  # Install Ruby 3.0.0
  rbenv install 3.0.0
  rbenv global 3.0.0

  # Verify
  ruby --version
  What to check: Ruby version should show ruby 3.0.0

  Step 6: Install Project Dependencies

  # Navigate to project directory
  cd /mnt/c/Users/adars/OneDrive/00OrganisedFilesProject/Work/Codefluent/Clients/wildlifeAI/ww_app/wildlife-watcher-mobile-app

  # Install Ruby gems
  gem install bundler
  bundle install

  # Install React Native CLI dev dependency
  npm install --save-dev @react-native-community/cli

  # Install iOS pods (if doing iOS development)
  cd ios && bundle exec pod install && cd ..
  What to check:
  - bundle install should complete without errors
  - npm install should complete without errors
  - iOS pods should install without errors

  Verification Commands

  After completing all steps, run these to verify everything is working:

  # Check all versions
  node --version          # Should be v20.x.x
  npm --version           # Should be 10.x.x
  java -version           # Should be openjdk 11.x.x
  ruby --version          # Should be ruby 3.0.0
  npx react-native --version  # Should show RN CLI version

  # Check environment variables
  echo $JAVA_HOME         # Should show Java path
  echo $ANDROID_HOME      # Should show Android SDK path

  # Test React Native Metro server
  npx react-native start --reset-cache

  Expected Issues & Solutions

  1. If Node 20 install fails: Use curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - then sudo apt-get install -y nodejs
  2. If Android SDK download fails: Try using curl instead of wget
  3. If Ruby build fails: Install additional dependencies: sudo apt-get install -y libffi-dev libgdbm-dev libgdbm6
  4. If bundle install fails: Try gem update --system first

  Report Back With

  Once you've completed these steps, please report back with:
  1. Output of all the verification commands
  2. Any error messages you encountered
  3. Which steps completed successfully vs failed

  Then I can help you troubleshoot any remaining issues and test running the app!