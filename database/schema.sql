CREATE DATABASE IF NOT EXISTS dreamscape_yangzheng CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE dreamscape_yangzheng;
CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(50) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS dreams (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  title VARCHAR(120) NOT NULL,
  original_text TEXT NOT NULL,
  life_context TEXT NULL,
  dream_date DATE NOT NULL,
  self_emotion VARCHAR(20) NOT NULL DEFAULT '平静',
  self_intensity TINYINT NOT NULL DEFAULT 3,
  completion_mode VARCHAR(20) NOT NULL DEFAULT 'none',
  completed_text TEXT NULL,
  completion_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  favorite BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_dream_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT ck_intensity CHECK(self_intensity BETWEEN 1 AND 5),
  INDEX ix_dream_user_date(user_id,dream_date)
);
CREATE TABLE IF NOT EXISTS analyses (
  id CHAR(36) PRIMARY KEY,
  dream_id CHAR(36) NOT NULL,
  result_json JSON NOT NULL,
  model_name VARCHAR(80) NOT NULL,
  input_source VARCHAR(30) NOT NULL DEFAULT 'original',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_analysis_dream FOREIGN KEY(dream_id) REFERENCES dreams(id) ON DELETE CASCADE,
  INDEX ix_analysis_dream(dream_id)
);
CREATE TABLE IF NOT EXISTS analysis_references (
  id CHAR(36) PRIMARY KEY,
  analysis_id CHAR(36) NOT NULL,
  source_id VARCHAR(80) NOT NULL,
  title VARCHAR(500) NOT NULL,
  authors TEXT NULL,
  publication_year SMALLINT NULL,
  doi VARCHAR(200) NULL,
  url VARCHAR(600) NOT NULL,
  abstract_text MEDIUMTEXT NULL,
  CONSTRAINT fk_reference_analysis FOREIGN KEY(analysis_id) REFERENCES analyses(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS generated_images (
  id CHAR(36) PRIMARY KEY,
  dream_id CHAR(36) NOT NULL,
  analysis_id CHAR(36) NULL,
  style VARCHAR(30) NOT NULL,
  prompt TEXT NOT NULL,
  source_version VARCHAR(20) NOT NULL,
  task_id VARCHAR(120) NULL,
  status VARCHAR(20) NOT NULL,
  local_url VARCHAR(600) NULL,
  error_message VARCHAR(300) NULL,
  model_name VARCHAR(80) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_image_dream FOREIGN KEY(dream_id) REFERENCES dreams(id) ON DELETE CASCADE,
  CONSTRAINT fk_image_analysis FOREIGN KEY(analysis_id) REFERENCES analyses(id) ON DELETE SET NULL
);
