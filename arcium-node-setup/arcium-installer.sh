#!/usr/bin/env bash
# shellcheck shell=bash
# shellcheck disable=SC2039

# Arcium unified installation script
# This script installs arcup (Arcium version manager) and checks for required dependencies

set -u

# Script configuration
ARCUP_BASE_URL="https://bin.arcium.com/download"
INSTALL_DIR="$HOME/.cargo/bin"
MAX_RETRIES=3
RETRY_DELAY=2

# Runtime flags
QUIET="no"

# Version will be fetched dynamically
ARCUP_VERSION=""

# Colors and formatting
has_color() {
    [ -t 2 ] && [ "${TERM+set}" = 'set' ] && case "$TERM" in
        xterm*|rxvt*|urxvt*|linux*|vt*) return 0 ;;
    esac
    return 1
}

get_arcium_color_bold() {
    printf '\033[1;35m'  # Bright magenta - works everywhere
}

# Unicode symbols for better visual appeal
CHECKMARK="✓"
WARNING="⚠"
ERROR="✗"
ARROW="→"
BULLET="•"
ROCKET="🚀"
PACKAGE="📦"
GEAR="🔧"
SPARKLES="✨"

# Progress tracking
CURRENT_STEP=0
TOTAL_STEPS=6

print_msg() {
    local level="$1"
    local msg="$2"
    if has_color; then
        case "$level" in
            info)  printf '\033[1;32m%s\033[0m %s\n' "$CHECKMARK" "$msg" >&2 ;;
            warn)  printf '\033[1;33m%s\033[0m %s\n' "$WARNING" "$msg" >&2 ;;
            error) printf '\033[1;31m%s\033[0m %s\n' "$ERROR" "$msg" >&2 ;;
            step)  printf '\033[1;36m%s\033[0m %s\n' "$ARROW" "$msg" >&2 ;;
            success) printf '\033[1;32m%s\033[0m %s\n' "$SPARKLES" "$msg" >&2 ;;
        esac
    else
        case "$level" in
            info|success) printf '%s %s\n' "$CHECKMARK" "$msg" >&2 ;;
            warn)  printf '%s %s\n' "$WARNING" "$msg" >&2 ;;
            error) printf '%s %s\n' "$ERROR" "$msg" >&2 ;;
            step)  printf '%s %s\n' "$ARROW" "$msg" >&2 ;;
        esac
    fi
}

say() {
    if [ "$QUIET" != "yes" ]; then
        print_msg "info" "$1"
    fi
}

warn() {
    print_msg "warn" "$1"
}

err() {
    print_msg "error" "$1"
}

step() {
    if [ "$QUIET" != "yes" ]; then
        print_msg "step" "$1"
    fi
}

success() {
    if [ "$QUIET" != "yes" ]; then
        print_msg "success" "$1"
    fi
}

# Print a simple section header
print_section() {
    local title="$1"

    if [ "$QUIET" = "yes" ]; then
        return 0
    fi

    printf '\n'

    if has_color; then
        printf '\033[1;36m%s\033[0m\n' "$title" >&2
    else
        printf '%s\n' "$title" >&2
    fi
    printf '\n'
}

# Print simple bold text header
print_arcium_header() {
    local title="$1"

    if [ "$QUIET" = "yes" ]; then
        return 0
    fi

    printf '\n'

    if has_color; then
        arcium_color_bold="$(get_arcium_color_bold)"
        printf '%s%s\033[0m\n' "$arcium_color_bold" "$title" >&2
    else
        printf '%s\n' "$title" >&2
    fi
    printf '\n'
}

# Show current step progress
show_progress() {
    CURRENT_STEP=$((CURRENT_STEP + 1))
    if [ "$QUIET" != "yes" ]; then
        if has_color; then
            printf '\033[1;35m[Step %d/%d]\033[0m %s\n' "$CURRENT_STEP" "$TOTAL_STEPS" "$1" >&2
        else
            printf '[Step %d/%d] %s\n' "$CURRENT_STEP" "$TOTAL_STEPS" "$1" >&2
        fi
    fi
}

# Simple spinner animation
show_spinner() {
    local pid=$1
    local delay=0.1
    local spinstr='|/-\'
    local temp

    if [ "$QUIET" = "yes" ]; then
        wait "$pid"
        return $?
    fi

    printf ' '
    while kill -0 "$pid" 2>/dev/null; do
        temp=${spinstr#?}
        if has_color; then
            printf '\033[1;33m%s\033[0m\b' "${spinstr%"$temp"}"
        else
            printf '%s\b' "${spinstr%"$temp"}"
        fi
        spinstr=$temp${spinstr%"$temp"}
        sleep $delay
    done
    printf ' \b'
    wait "$pid"
    return $?
}

need_cmd() {
    if ! check_cmd "$1"; then
        err "need '$1' (command not found)"
        exit 1
    fi
}

check_cmd() {
    command -v "$1" > /dev/null 2>&1
}

ensure() {
    if ! "$@"; then
        err "command failed: $*"
        exit 1
    fi
}

# Platform detection (adapted from rustup)
get_architecture() {
    local _ostype _cputype _arch
    _ostype="$(uname -s)"
    _cputype="$(uname -m)"

    if [ "$_ostype" = Darwin ]; then
        # Handle macOS architecture detection including Rosetta
        if [ "$_cputype" = i386 ]; then
            if sysctl hw.optional.x86_64 2> /dev/null | grep -q ': 1'; then
                _cputype=x86_64
            fi
        elif [ "$_cputype" = x86_64 ]; then
            if sysctl hw.optional.arm64 2> /dev/null | grep -q ': 1'; then
                _cputype=arm64
            fi
        fi
        _ostype=macos
    elif [ "$_ostype" = Linux ]; then
        _ostype=linux
    else
        err "unsupported OS: $_ostype"
        exit 1
    fi

    case "$_cputype" in
        aarch64 | arm64)
            _cputype=aarch64
            ;;
        x86_64 | x86-64 | x64 | amd64)
            _cputype=x86_64
            ;;
        *)
            err "unsupported CPU type: $_cputype"
            exit 1
            ;;
    esac

    _arch="${_cputype}_${_ostype}"
    echo "$_arch"
}

# Dependency checking functions
check_rust() {
    step "Checking for Rust installation..."
    if ! check_cmd rustc || ! check_cmd cargo; then
        err "Rust is not installed"
        err ""
        err "📖 Install Rust by running:"
        err "   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
        err ""
        err "📋 For more information: https://www.rust-lang.org/tools/install"
        return 1
    fi
    local rust_version
    rust_version="$(rustc --version 2>/dev/null | cut -d' ' -f2)"
    say "Rust $rust_version"
    return 0
}

check_solana() {
    step "Checking for Solana CLI..."
    if ! check_cmd solana; then
        err "Solana CLI is not installed"
        err ""
        err "📖 Install Solana CLI by running:"
        err "   curl --proto '=https' --tlsv1.2 -sSfL https://solana-install.solana.workers.dev | bash"
        err ""
        err "📋 Documentation: https://docs.solana.com/cli/install-solana-cli-tools"
        return 1
    fi
    local solana_version
    solana_version="$(solana --version 2>/dev/null | cut -d' ' -f2)"
    say "Solana CLI $solana_version"
    return 0
}

check_yarn() {
    step "Checking for Yarn package manager..."
    if ! check_cmd yarn; then
        err "Yarn is not installed"
        err ""
        if check_cmd npm; then
            err "📖 Install Yarn by running:"
            err "   npm install -g yarn"
        elif check_cmd corepack; then
            err "📖 Enable Yarn via corepack:"
            err "   corepack enable"
        else
            err "📖 Install Node.js first, then install Yarn:"
            err "   Visit: https://nodejs.org/"
        fi
        err ""
        err "📋 Documentation: https://yarnpkg.com/getting-started/install"
        return 1
    fi
    local yarn_version
    yarn_version="$(yarn --version 2>/dev/null)"
    say "Yarn $yarn_version"
    return 0
}

check_anchor() {
    step "Checking for Anchor framework..."
    if ! check_cmd anchor; then
        err "Anchor is not installed"
        err ""
        err "📖 Install Anchor by running:"
        err "   cargo install --git https://github.com/coral-xyz/anchor avm --locked --force"
        err "   avm install latest"
        err "   avm use latest"
        err ""
        err "📋 Documentation: https://www.anchor-lang.com/docs/installation"
        return 1
    fi
    local anchor_version
    anchor_version="$(anchor --version 2>/dev/null | cut -d' ' -f2)"
    say "Anchor $anchor_version"
    return 0
}

check_docker() {
    step "Checking for Docker..."
    if ! check_cmd docker; then
        err "Docker is not installed"
        err ""
        local os_type
        os_type="$(uname -s)"
        if [ "$os_type" = "Darwin" ]; then
            err "📖 Install Docker Desktop for Mac:"
            err "   Visit: https://docs.docker.com/desktop/install/mac-install/"
        elif [ "$os_type" = "Linux" ]; then
            err "📖 Install Docker Engine for Linux:"
            err "   Visit: https://docs.docker.com/engine/install/"
        fi
        err ""
        err "📋 General documentation: https://docs.docker.com/engine/install/"
        return 1
    fi

    if ! docker compose --version > /dev/null 2>&1; then
        err "Docker Compose is not available"
        err ""
        err "📖 Docker Compose should be included with Docker Desktop"
        err "   If using Docker Engine, install Docker Compose plugin:"
        err "   https://docs.docker.com/compose/install/"
        err ""
        err "🔧 Make sure 'docker compose' (not 'docker-compose') works"
        return 1
    fi

    local docker_version compose_version
    docker_version="$(docker --version 2>/dev/null | cut -d' ' -f3 | tr -d ',')"
    compose_version="$(docker compose version 2>/dev/null | head -n1 | cut -d' ' -f4)"
    say "Docker $docker_version"
    say "Docker Compose $compose_version"
    return 0
}

install_linux_deps() {
    if [ "$(uname -s)" != "Linux" ]; then
        return 0
    fi

    show_progress "Installing Linux build dependencies..."

    if check_cmd apt-get; then
        if ! sudo -n true 2>/dev/null; then
            err "This script needs sudo access to install Linux dependencies"
            err ""
            err "📖 Please run with sudo privileges or install manually:"
            err "   sudo apt-get update"
            err "   sudo apt-get install -y pkg-config build-essential libudev-dev libssl-dev"
            err ""
            err "🔧 Or grant sudo access and re-run this script"
            exit 1
        fi

        step "Updating package lists..."
        ensure sudo apt-get update

        step "Installing build dependencies..."
        ensure sudo apt-get install -y pkg-config build-essential libudev-dev libssl-dev
        success "Linux build dependencies installed"
    else
        warn "Could not detect package manager (apt-get not found)"
        warn ""
        warn "📖 Please install these packages manually:"
        warn "   • pkg-config"
        warn "   • build-essential (or equivalent)"
        warn "   • libudev-dev (or equivalent)"
        warn "   • libssl-dev (or equivalent)"
    fi
}

check_path() {
    if ! echo "$PATH" | grep -q "$INSTALL_DIR"; then
        warn "~/.cargo/bin is not in your PATH"
        warn ""
        warn "📖 Add this line to your shell profile:"
        local shell_name
        shell_name="$(basename "$SHELL" 2>/dev/null || echo "bash")"
        case "$shell_name" in
            zsh)  warn "   echo 'export PATH=\"\$HOME/.cargo/bin:\$PATH\"' >> ~/.zshrc" ;;
            bash) warn "   echo 'export PATH=\"\$HOME/.cargo/bin:\$PATH\"' >> ~/.bashrc" ;;
            fish) warn "   fish_add_path ~/.cargo/bin" ;;
            *)    warn "   export PATH=\"\$HOME/.cargo/bin:\$PATH\"" ;;
        esac
        warn ""
        warn "🔄 Then restart your terminal or source your profile"
    fi
}

# Fetch latest version from Arcium's version API
fetch_latest_version() {
    local major_minor_url="${ARCUP_BASE_URL}/versions/latest-tooling"
    local major_minor
    local full_version_url
    local full_version

    show_progress "Fetching latest arcup version..."
    step "Connecting to version API..."

    # Fetch major.minor version
    if check_cmd curl; then
        major_minor=$(curl --proto '=https' --tlsv1.2 --silent --fail --location "$major_minor_url" 2>/dev/null | tr -d '\n' | tr -d '\r')
    elif check_cmd wget; then
        major_minor=$(wget --https-only --secure-protocol=TLSv1_2 -q -O - "$major_minor_url" 2>/dev/null | tr -d '\n' | tr -d '\r')
    else
        err "Neither curl nor wget found"
        err ""
        err "📖 Please install curl or wget:"
        err "   • macOS: brew install curl"
        err "   • Ubuntu/Debian: sudo apt-get install curl"
        err "   • CentOS/RHEL: sudo yum install curl"
        exit 1
    fi

    if [ -z "$major_minor" ]; then
        err "Failed to fetch version information"
        err ""
        err "🌐 Connection issues detected:"
        err "   URL: $major_minor_url"
        err "   This might be due to:"
        err "   • Network connectivity problems"
        err "   • Firewall blocking the connection"
        err "   • Service temporarily unavailable"
        err ""
        err "🔧 Try again in a moment, or check your internet connection"
        exit 1
    fi

    step "Resolving full version number..."

    # Fetch patch version
    full_version_url="${ARCUP_BASE_URL}/versions/latest-tooling-${major_minor}"

    if check_cmd curl; then
        patch_version=$(curl --proto '=https' --tlsv1.2 --silent --fail --location "$full_version_url" 2>/dev/null | tr -d '\n' | tr -d '\r')
    elif check_cmd wget; then
        patch_version=$(wget --https-only --secure-protocol=TLSv1_2 -q -O - "$full_version_url" 2>/dev/null | tr -d '\n' | tr -d '\r')
    fi

    if [ -z "$patch_version" ]; then
        err "Failed to fetch complete version information"
        err ""
        err "🌐 URL: $full_version_url"
        err "🔧 Please check your internet connection and try again"
        exit 1
    fi

    # Combine major.minor with patch to get full semver version
    ARCUP_VERSION="${major_minor}.${patch_version}"
    success "Found latest version: $ARCUP_VERSION"
}

# This wraps curl or wget. Try curl first, if not installed,
# use wget instead.
downloader() {
    if check_cmd curl; then
        program=curl
    elif check_cmd wget; then
        program=wget
    else
        program='curl or wget' # to be used in error message of need_cmd
    fi

    if [ "$1" = --check ]; then
        need_cmd "$program"
    elif [ "$program" = curl ]; then
        local attempt=1
        while [ "$attempt" -le "$MAX_RETRIES" ]; do
            if [ "$attempt" -gt 1 ]; then
                say "Download failed, retrying (attempt $attempt/$MAX_RETRIES)..."
                sleep "$RETRY_DELAY"
            fi
            if curl --proto '=https' --tlsv1.2 --silent --fail --location "$1" --output "$2"; then
                return 0
            fi
            attempt=$((attempt + 1))
        done
        return 1
    elif [ "$program" = wget ]; then
        local attempt=1
        while [ "$attempt" -le "$MAX_RETRIES" ]; do
            if [ "$attempt" -gt 1 ]; then
                say "Download failed, retrying (attempt $attempt/$MAX_RETRIES)..."
                sleep "$RETRY_DELAY"
            fi
            if wget --https-only --secure-protocol=TLSv1_2 --quiet "$1" -O "$2"; then
                return 0
            fi
            attempt=$((attempt + 1))
        done
        return 1
    else
        err "Unknown downloader"   # should not reach here
    fi
}

# Run command with retry logic
run_with_retry() {
    local max_retries="$MAX_RETRIES"
    local retry_delay="$RETRY_DELAY"
    local attempt=1

    while [ "$attempt" -le "$max_retries" ]; do
        if [ "$attempt" -gt 1 ]; then
            say "Command failed, retrying (attempt $attempt/$max_retries)..."
            sleep "$retry_delay"
        fi

        if "$@"; then
            return 0
        fi

        attempt=$((attempt + 1))
    done

    # All retries failed
    err "Command failed after $max_retries attempts: $*"
    return 1
}

download_arcup() {
    local target="$1"
    local url="${ARCUP_BASE_URL}/arcup_${target}_${ARCUP_VERSION}"
    local temp_file

    show_progress "Downloading arcup for $target..."

    # Create install directory if it doesn't exist
    step "Creating installation directory..."
    mkdir -p "$INSTALL_DIR"

    temp_file="$(mktemp)"

    step "Downloading binary..."
    if [ "$QUIET" != "yes" ]; then
        printf "   %s %s\n" "$PACKAGE" "Downloading from: $url" >&2
    fi

    # Download the file with spinner
    downloader "$url" "$temp_file" &
    download_pid=$!
    if ! show_spinner $download_pid; then
        rm -f "$temp_file"
        exit 1
    fi

    step "Installing arcup binary..."
    ensure mv "$temp_file" "$INSTALL_DIR/arcup"
    ensure chmod +x "$INSTALL_DIR/arcup"

    success "arcup installed to $INSTALL_DIR/arcup"
}

install_arcium_cli() {
    show_progress "Installing Arcium CLI..."
    step "Running arcup install..."
    run_with_retry "$INSTALL_DIR/arcup" install &
    install_pid=$!
    if ! show_spinner $install_pid; then
        err "Failed to install Arcium CLI via arcup"
        err ""
        err "🔧 Troubleshooting steps:"
        err "   1. Ensure arcup is in your PATH: export PATH=\"\$HOME/.cargo/bin:\$PATH\""
        err "   2. Try running manually: arcup install"
        err "   3. Check network connectivity"
        err "   4. Verify disk space in ~/.cargo/bin/"
        err ""
        err "📋 For more help: https://docs.arcium.com/cli/installation"
        exit 1
    fi
    success "Arcium CLI installed successfully"
}

verify_installation() {
    show_progress "Verifying installation..."

    step "Checking arcup availability..."
    if ! check_cmd arcup; then
        err "arcup not found in PATH after installation"
        err ""
        check_path
        exit 1
    fi
    say "arcup is available"

    step "Checking Arcium CLI availability..."
    if ! check_cmd arcium; then
        err "Arcium CLI not found after installation"
        err ""
        err "🔧 This might indicate:"
        err "   • Installation incomplete"
        err "   • PATH not updated correctly"
        err "   • Permission issues"
        err ""
        err "📖 Try running: arcup install"
        exit 1
    fi

    local version
    version="$(arcium --version 2>/dev/null)"
    success "Installation verified: $version"
}

# Print installation summary
print_installation_summary() {
    local arx_node_version arcium_version

    if [ "$QUIET" = "yes" ]; then
        return 0
    fi

    print_arcium_header "Installation Summary"

    # Gather version information
    arx_node_version="$(arcup ls 2>/dev/null | grep -i "arx" | head -n1 | awk '{print $NF}' || echo "N/A")"
    arcium_version="$(arcium --version 2>/dev/null || echo "N/A")"

    # Print summary table
    if has_color; then
        arcium_color_bold="$(get_arcium_color_bold)"
        printf '%s%-20s\033[0m %s\033[0m\n' "$arcium_color_bold" "Arcium CLI:" "$arcium_version" >&2
        printf '\033[1;37m%-20s\033[0m \033[1;32m%s\033[0m\n' "Arx Node:" "$arx_node_version" >&2
    else
        printf '%-20s %s\n' "Arcium CLI:" "$arcium_version" >&2
        printf '%-20s %s\n' "Arx Node:" "$arx_node_version" >&2
    fi

    printf '\n'

    # Next steps section
    if has_color; then
        printf '\033[1;37m%s Next Steps\033[0m\n' "$ROCKET" >&2
    else
        printf '%s Next Steps\n' "$ROCKET" >&2
    fi
    printf '\n'

    step "Initialize a new project: arcium init my-project"
    step "Build circuits: arcium build"
    step "Start local network: arcium localnet"
    step "Get help: arcium --help"

    printf '\n'

    if has_color; then
        printf '\033[1;37m%s Resources\033[0m\n' "$GEAR" >&2
    else
        printf '%s Resources\n' "$GEAR" >&2
    fi
    printf '\n'

    step "Documentation: https://docs.arcium.com/"
    step "Examples: https://github.com/arcium-hq/examples"
    step "Discord: https://discord.gg/arcium"

    printf '\n'
}

main() {
    print_arcium_header "Installing Arcium Tooling"

    # Check basic requirements
    need_cmd uname
    need_cmd mktemp
    need_cmd chmod
    need_cmd mkdir
    need_cmd mv

    # Install Linux dependencies first
    install_linux_deps

    # Check all required dependencies
    print_section "Checking Dependencies"
    local deps_ok=true

    # Reset step counter for dependency checking
    CURRENT_STEP=0
    TOTAL_STEPS=5

    if ! check_rust; then deps_ok=false; fi
    if ! check_solana; then deps_ok=false; fi
    if ! check_yarn; then deps_ok=false; fi
    if ! check_anchor; then deps_ok=false; fi
    if ! check_docker; then deps_ok=false; fi

    if [ "$deps_ok" = "false" ]; then
        printf '\n'
        err "Some dependencies are missing. Please install them and run this script again."
        printf '\n'
        err "💡 Tip: Install missing dependencies using the commands shown above,"
        err "    then re-run this script to continue the installation."
        exit 1
    fi

    success "All dependencies satisfied!"

    # Reset step counter for installation
    CURRENT_STEP=0
    TOTAL_STEPS=6

    print_arcium_header "Installation"

    # Fetch latest version
    fetch_latest_version

    # Detect platform and download arcup
    local target
    target="$(get_architecture)"
    step "Detected platform: $target"

    download_arcup "$target"
    install_arcium_cli
    verify_installation

    # Check PATH and show summary
    check_path
    print_installation_summary

    success "Arcium installation complete!"

    if [ "$QUIET" != "yes" ]; then
        printf '\n'
        if has_color; then
            printf '\033[1;32m%s Ready to build encrypted applications with Arcium!\033[0m\n' "$SPARKLES" >&2
        else
            printf '%s Ready to build encrypted applications with Arcium!\n' "$SPARKLES" >&2
        fi
        printf '\n'
    fi
}

# Handle help
case "${1:-}" in
    -h|--help)
        if has_color; then
            arcium_color_bold="$(get_arcium_color_bold)"
            printf '%sInstalling Arcium Tooling\033[0m\n' "$arcium_color_bold" >&2
            printf '\n' >&2
            printf '\033[1;37mThis script installs arcup (Arcium version manager) and the Arcium CLI\n' >&2
            printf 'with enhanced visual feedback and progress tracking.\033[0m\n' >&2
            printf '\n' >&2
            printf '\033[1;33mUSAGE:\033[0m\n' >&2
            printf '    %s [OPTIONS]\n' "$0" >&2
            printf '\n' >&2
            printf '\033[1;33mOPTIONS:\033[0m\n' >&2
            printf '    -h, --help       Show this help message\n' >&2
            printf '    -q, --quiet      Suppress non-error output and progress indicators\n' >&2
            printf '\n' >&2
            printf '\033[1;33mDEPENCENCIES:\033[0m\n' >&2
            printf 'This script checks for and requires the following tools:\n' >&2
            printf '    \033[1;32m✓\033[0m Rust (rustc, cargo)\n' >&2
            printf '    \033[1;32m✓\033[0m Solana CLI\n' >&2
            printf '    \033[1;32m✓\033[0m Yarn package manager\n' >&2
            printf '    \033[1;32m✓\033[0m Anchor framework\n' >&2
            printf '    \033[1;32m✓\033[0m Docker & Docker Compose\n' >&2
            printf '\n' >&2
            printf '\033[1;33mLINUX SUPPORT:\033[0m\n' >&2
            printf 'On Linux systems, build dependencies are installed automatically:\n' >&2
            printf '    • pkg-config • build-essential • libudev-dev • libssl-dev\n' >&2
            printf '\n' >&2
            printf '\033[1;33mFEATURES:\033[0m\n' >&2
            printf '    🎯 Step-by-step progress tracking\n' >&2
            printf '    📊 Visual progress indicators\n' >&2
            printf '    🔍 Enhanced error messages with troubleshooting tips\n' >&2
            printf '    📋 Installation summary with version information\n' >&2
            printf '    🚀 Next steps and resource links\n' >&2
            printf '\n' >&2
            printf 'For more information, visit: \033[1;36mhttps://docs.arcium.com/\033[0m\n' >&2
        else
            cat <<EOF
=== Arcium Installation Script ===

This script installs arcup (Arcium version manager) and the Arcium CLI
with enhanced visual feedback and progress tracking.

USAGE:
    $0 [OPTIONS]

OPTIONS:
    -h, --help       Show this help message
    -q, --quiet      Suppress non-error output and progress indicators

DEPENDENCIES:
This script checks for and requires:
    * Rust (rustc, cargo)
    * Solana CLI
    * Yarn package manager
    * Anchor framework
    * Docker & Docker Compose

LINUX SUPPORT:
On Linux, build dependencies are installed automatically:
    • pkg-config • build-essential • libudev-dev • libssl-dev

FEATURES:
    * Step-by-step progress tracking
    * Enhanced error messages with troubleshooting tips
    * Installation summary with version information
    * Next steps and resource links

For more information, visit: https://docs.arcium.com/
EOF
        fi
        exit 0
        ;;
    -q|--quiet)
        QUIET=yes
        ;;
    "")
        ;;
    *)
        err "Unknown option: $1"
        err "Use --help for usage information"
        exit 1
        ;;
esac

main "$@"