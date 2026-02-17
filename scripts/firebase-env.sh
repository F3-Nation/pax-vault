#!/usr/bin/env bash

# Setup PATH for gcloud/firebase CLI (common installation locations)
export PATH="$PATH:$HOME/google-cloud-sdk/bin:/usr/local/bin:/opt/homebrew/bin"

# Source gcloud path if installed via Google installer
if [[ -f "$HOME/google-cloud-sdk/path.bash.inc" ]]; then
  source "$HOME/google-cloud-sdk/path.bash.inc"
fi

# Configuration constants
SECRET_VARS=("NEXT_PUBLIC_SITE_URL" "SAMPLE_PAX" "SAMPLE_AO" "SAMPLE_REGION" "ENVIRONMENT" "BIGQUERY_PROJECT_ID" "BIGQUERY_DATASET" "BIGQUERY_CLIENT_EMAIL" "BIGQUERY_PRIVATE_KEY" "OAUTH_CLIENT_ID" "OAUTH_CLIENT_SECRET" "OAUTH_REDIRECT_URI" "AUTH_PROVIDER_URL" "SESSION_SECRET")
SECRET_IDS_PROD=("next-public-site-url" "sample-pax" "sample-ao" "sample-region" "environment" "bigquery-project-id" "bigquery-dataset" "bigquery-client-email" "bigquery-private-key" "oauth-client-id" "oauth-client-secret" "oauth-redirect-uri" "auth-provider-url" "session-secret")

# BQ secrets are shared between prod and staging (no prefix)
BQ_SECRET_IDS=("bigquery-project-id" "bigquery-dataset" "bigquery-client-email" "bigquery-private-key")

#####################################
# MAIN EXECUTION FUNCTION
#####################################

main() {
  set -euo pipefail

  # Parse --env argument
  local target_env="prod"
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --env)
        target_env="$2"
        shift 2
        ;;
      *)
        log_error "Unknown argument: $1"
        exit 1
        ;;
    esac
  done

  # Verify required CLI tools are available
  if ! command -v gcloud &>/dev/null; then
    log_error "gcloud CLI not found. Please install Google Cloud SDK:"
    log_error "  brew install google-cloud-sdk"
    log_error "  or visit: https://cloud.google.com/sdk/docs/install"
    exit 1
  fi

  # Get project root and file paths
  local project_root=$(get_project_root)

  # Set env file and backend ID based on target environment
  local env_file
  local backend_id
  if [[ "$target_env" == "staging" ]]; then
    env_file="$project_root/.env.firebase.staging"
    backend_id="pax-vault-staging"
    log_info "Targeting staging environment"
  else
    env_file="$project_root/.env.firebase.production"
  fi

  # Build SECRET_IDS array based on target environment
  SECRET_IDS=()
  for id in "${SECRET_IDS_PROD[@]}"; do
    if [[ "$target_env" == "staging" ]]; then
      # Check if this is a BQ secret (shared, no prefix)
      local is_bq=false
      for bq_id in "${BQ_SECRET_IDS[@]}"; do
        if [[ "$id" == "$bq_id" ]]; then
          is_bq=true
          break
        fi
      done
      if [[ "$is_bq" == true ]]; then
        SECRET_IDS+=("$id")
      else
        SECRET_IDS+=("staging-$id")
      fi
    else
      SECRET_IDS+=("$id")
    fi
  done

  # Load configuration
  log_step "Loading configuration from Firebase files..."
  local project_id=$(read_project_id "$project_root")
  if [[ -z "$project_id" ]]; then
    exit 1
  fi

  # Read backend ID from firebase.json if not already set (prod)
  if [[ -z "${backend_id:-}" ]]; then
    backend_id=$(read_backend_id "$project_root")
    if [[ -z "$backend_id" ]]; then
      exit 1
    fi
  fi

  log_info "Using project ID: $project_id"
  log_info "Using backend ID: $backend_id"

  # Set GCP project
  log_step "Setting GCP project to '$project_id'..."
  gcloud config set project "$project_id" --quiet >/dev/null

  # Validate and load environment
  validate_env_file "$env_file" || exit 1
  load_environment_variables "$env_file"
  validate_environment_variables || exit 1

  # Create temporary directory
  local temp_dir=$(mktemp -d)

  # Create secrets
  create_temp_secret_files "$temp_dir"
  create_or_update_secrets "$project_id" "$temp_dir"
  grant_iam_permissions "$project_id"
  grant_firebase_access "$project_id" "$backend_id"

  # Cleanup
  cleanup_temp_files "$temp_dir"

  log_success "All done! Your App Hosting backend can now build & run with these secrets."
}

#####################################
# UTILITY FUNCTIONS (used by main)
#####################################

# Get the project root directory
get_project_root() {
  local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  echo "$(dirname "$script_dir")"
}

# Print colored output
log_info() {
  echo "ℹ️  $1"
}

log_success() {
  echo "✅ $1"
}

log_warning() {
  echo "⚠️  $1"
}

log_error() {
  echo "❌ $1"
}

log_step() {
  echo "🔧 $1"
}

#####################################
# CONFIGURATION FUNCTIONS (used by main)
#####################################

# Read project ID from .firebaserc
read_project_id() {
  local project_root="$1"
  local firebaserc_file="$project_root/.firebaserc"
  
  if [[ ! -f "$firebaserc_file" ]]; then
    log_error ".firebaserc file not found at $firebaserc_file"
    return 1
  fi
  
  local project_id=$(grep -o '"default": *"[^"]*"' "$firebaserc_file" | cut -d'"' -f4)
  if [[ -z "$project_id" ]]; then
    log_error "Could not find project ID in .firebaserc"
    return 1
  fi
  
  echo "$project_id"
}

# Read backend ID from firebase.json
read_backend_id() {
  local project_root="$1"
  local firebase_json_file="$project_root/firebase.json"
  
  if [[ ! -f "$firebase_json_file" ]]; then
    log_error "firebase.json file not found at $firebase_json_file"
    return 1
  fi
  
  local backend_id=$(grep -o '"backendId": *"[^"]*"' "$firebase_json_file" | head -1 | cut -d'"' -f4)
  if [[ -z "$backend_id" ]]; then
    log_error "Could not find backendId in firebase.json"
    return 1
  fi
  
  echo "$backend_id"
}

#####################################
# ENVIRONMENT VALIDATION FUNCTIONS (used by main)
#####################################

# Validate env file exists
validate_env_file() {
  local env_file="$1"

  if [[ ! -f "$env_file" ]]; then
    log_error "Env file not found at $env_file"
    log_error "Please create this file with your environment variables."
    return 1
  fi

  log_success "Found env file: $env_file"
}

# Load environment variables from env file
load_environment_variables() {
  local env_file="$1"

  log_step "Loading environment variables from $(basename "$env_file")..."

  # Read file and handle multi-line values properly
  local current_var=""
  local current_value=""
  local in_multiline=false

  while IFS= read -r line || [[ -n "$line" ]]; do
    # Skip empty lines and comments when not in multiline mode
    if [[ "$in_multiline" == false ]]; then
      [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue

      # Check if line starts a variable assignment
      if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)= ]]; then
        current_var="${BASH_REMATCH[1]}"
        local value_part="${line#*=}"

        # Check if value starts with a quote
        if [[ "$value_part" =~ ^\" ]]; then
          # Remove leading quote
          value_part="${value_part#\"}"

          # Check if it ends with a quote (single line)
          if [[ "$value_part" =~ \"$ ]]; then
            current_value="${value_part%\"}"
            export "$current_var=$current_value"
          else
            # Multi-line value
            current_value="$value_part"
            in_multiline=true
          fi
        else
          # Unquoted value (single line)
          export "$current_var=$value_part"
        fi
      fi
    else
      # In multiline mode - look for closing quote
      if [[ "$line" =~ \"$ ]]; then
        current_value="$current_value
${line%\"}"
        export "$current_var=$current_value"
        in_multiline=false
      else
        current_value="$current_value
$line"
      fi
    fi
  done < "$env_file"
}

# Validate required environment variables
validate_environment_variables() {
  log_step "Validating required environment variables..."
  
  for i in "${!SECRET_VARS[@]}"; do
    local envvar="${SECRET_VARS[$i]}"
    
    if [[ -z "${!envvar:-}" ]]; then
      log_error "$envvar is not set in env file"
      log_error "Please add $envvar=your_value to your env file"
      return 1
    fi

    # Check if variable contains placeholder values
    if [[ "${!envvar}" == *"YOUR_"* ]] || [[ "${!envvar}" == *"your-"* ]]; then
      log_warning "$envvar appears to contain placeholder values."
      log_error "Please update it with your actual value in .env.firebase"
      return 1
    fi
    
    log_success "Found: $envvar"
  done
}

#####################################
# SECRET MANAGEMENT FUNCTIONS (used by main)
#####################################

# Create temporary files for secrets
create_temp_secret_files() {
  local temp_dir="$1"
  
  log_step "Creating temporary secret files..."
  
  for i in "${!SECRET_VARS[@]}"; do
    local envvar="${SECRET_VARS[$i]}"
    local secret_id="${SECRET_IDS[$i]}"
    local temp_file="$temp_dir/$secret_id.txt"
    
    # Write the environment variable value to a temporary file (no trailing newline)
    printf '%s' "${!envvar}" > "$temp_file"
    log_info "Created temporary file: $temp_file"
  done
}

# Get current secret value from GCP
get_current_secret_value() {
  local project_id="$1"
  local secret_id="$2"

  gcloud secrets versions access latest \
    --secret="$secret_id" \
    --project="$project_id" \
    2>/dev/null || echo ""
}

# Delete old secret versions (keep only the latest)
delete_old_secret_versions() {
  local project_id="$1"
  local secret_id="$2"

  # List all versions except the latest, then destroy them
  local versions=$(gcloud secrets versions list "$secret_id" \
    --project="$project_id" \
    --filter="state:ENABLED AND NOT name~versions/latest" \
    --format="value(name)" \
    2>/dev/null)

  if [[ -n "$versions" ]]; then
    # Get the latest version number to exclude it
    local latest_version=$(gcloud secrets versions list "$secret_id" \
      --project="$project_id" \
      --filter="state:ENABLED" \
      --sort-by="~createTime" \
      --limit=1 \
      --format="value(name)" | grep -oE '[0-9]+$')

    while IFS= read -r version; do
      local version_num=$(echo "$version" | grep -oE '[0-9]+$')
      if [[ "$version_num" != "$latest_version" ]]; then
        log_info "Destroying old version $version_num of '$secret_id'…"
        gcloud secrets versions destroy "$version_num" \
          --secret="$secret_id" \
          --project="$project_id" \
          --quiet
      fi
    done <<< "$versions"
  fi
}

# Create or update secrets in Google Cloud Secret Manager
create_or_update_secrets() {
  local project_id="$1"
  local temp_dir="$2"

  log_step "Creating or updating secrets in Google Cloud Secret Manager..."

  for i in "${!SECRET_VARS[@]}"; do
    local secret_id="${SECRET_IDS[$i]}"
    local temp_file="$temp_dir/$secret_id.txt"
    local new_value=$(cat "$temp_file")

    if gcloud secrets describe "$secret_id" --project="$project_id" --quiet &>/dev/null; then
      # Secret exists - check if value has changed
      local current_value=$(get_current_secret_value "$project_id" "$secret_id")

      if [[ "$current_value" == "$new_value" ]]; then
        log_info "Secret '$secret_id' unchanged, skipping…"
      else
        log_info "Secret '$secret_id' changed, adding new version…"
        gcloud secrets versions add "$secret_id" \
          --data-file="$temp_file" \
          --project="$project_id" \
          --quiet

        # Delete old versions to keep only the latest
        delete_old_secret_versions "$project_id" "$secret_id"
      fi
    else
      log_info "Creating secret '$secret_id'…"
      gcloud secrets create "$secret_id" \
        --data-file="$temp_file" \
        --project="$project_id" \
        --quiet
    fi
  done
}

# Grant IAM permissions to Firebase service account
grant_iam_permissions() {
  local project_id="$1"
  
  log_step "Granting IAM permissions to Firebase service account..."
  
  for i in "${!SECRET_VARS[@]}"; do
    local secret_id="${SECRET_IDS[$i]}"
    log_info "Granting roles/secretmanager.secretAccessor on '$secret_id' to Firebase service account…"
    gcloud secrets add-iam-policy-binding "$secret_id" \
      --member="serviceAccount:service-971892823924@gcp-sa-firebaseapphosting.iam.gserviceaccount.com" \
      --role="roles/secretmanager.secretAccessor" \
      --project="$project_id" \
      --quiet
  done
}

# Grant Firebase App Hosting access to secrets
grant_firebase_access() {
  local project_id="$1"
  local backend_id="$2"

  log_step "Granting Firebase App Hosting access to secrets..."

  for i in "${!SECRET_VARS[@]}"; do
    local secret_id="${SECRET_IDS[$i]}"
    log_info "Granting Firebase App Hosting access to '$secret_id' on backend '$backend_id'…"
    npx -y -p firebase-tools firebase apphosting:secrets:grantaccess "$secret_id" \
      --backend "$backend_id" \
      --project "$project_id" \
      --non-interactive
  done
}

#####################################
# CLEANUP FUNCTIONS (used by main)
#####################################

# Clean up temporary files
cleanup_temp_files() {
  local temp_dir="$1"
  
  log_step "Cleaning up temporary files..."
  rm -rf "$temp_dir"
}

#####################################
# SCRIPT EXECUTION
#####################################

# Run main function with all script arguments
main "$@"
