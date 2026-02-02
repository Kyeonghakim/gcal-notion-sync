# Google Calendar → Notion Sync 설정 가이드

이 프로젝트를 실행하기 위해 Google Cloud Platform(GCP)과 Notion에서 API 키를 발급받아야 합니다.

## 1. Google Calendar API 설정

### 1.1 GCP 프로젝트 및 서비스 계정 생성
1. [Google Cloud Console](https://console.cloud.google.com/)에 접속합니다.
2. 새 프로젝트를 생성합니다 (예: `gcal-notion-sync`).
3. **API 및 서비스 > 라이브러리**로 이동하여 **"Google Calendar API"**를 검색하고 **사용**을 클릭합니다.
4. **API 및 서비스 > 사용자 인증 정보**로 이동합니다.
5. **사용자 인증 정보 만들기 > 서비스 계정**을 선택합니다.
6. 서비스 계정 이름(예: `gcal-sync-bot`)을 입력하고 **완료**를 클릭합니다. (권한 설정은 건너뛰어도 됩니다)

### 1.2 JSON 키 발급
1. 생성된 서비스 계정을 클릭합니다.
2. **키** 탭으로 이동하여 **키 추가 > 새 키 만들기**를 선택합니다.
3. **JSON**을 선택하고 **만들기**를 클릭합니다.
4. 다운로드된 JSON 파일을 텍스트 편집기로 엽니다. 이 내용은 나중에 환경 변수에 사용됩니다.

### 1.3 캘린더 공유 (중요!)
1. 서비스 계정의 **이메일 주소**를 복사합니다 (예: `gcal-sync-bot@...iam.gserviceaccount.com`).
2. Google 캘린더 웹사이트로 이동합니다.
3. 동기화할 캘린더의 **설정 및 공유**로 들어갑니다.
4. **특정 사용자와 공유** 섹션에서 **사용자 추가**를 클릭합니다.
5. 복사한 서비스 계정 이메일을 붙여넣고 권한을 **"일정 보기(모든 일정 세부정보 보기)"**로 설정한 뒤 저장합니다.

## 2. Notion API 설정

### 2.1 통합(Integration) 생성
1. [Notion My Integrations](https://www.notion.so/my-integrations)에 접속합니다.
2. **새 API 통합 만들기**를 클릭합니다.
3. 이름을 입력(예: `Google Calendar Sync`)하고 워크스페이스를 선택한 뒤 **제출**합니다.
4. **"내부 통합 시크릿"** (Internal Integration Secret)을 복사해둡니다. (`secret_`으로 시작)

### 2.2 데이터베이스 연결 및 ID 확인
1. Notion에서 동기화할 데이터베이스 페이지를 엽니다.
2. 우측 상단 **...** 메뉴 > **연결** > 방금 만든 통합(`Google Calendar Sync`)을 선택하여 연결합니다.
3. 브라우저 주소창이나 **링크 복사**를 통해 데이터베이스 ID를 확인합니다.
   - URL 형식: `https://www.notion.so/myworkspace/a1b2c3d4e5f6...`
   - 여기서 `a1b2c3d4e5f6...` 부분(32자)이 데이터베이스 ID입니다.

## 3. 환경 변수 설정

1. 프로젝트 루트의 `.env.example` 파일을 복사하여 `.env` 파일을 생성합니다.
   ```bash
   cp .env.example .env
   ```
2. `.env` 파일을 열고 위에서 구한 값들을 채워넣습니다.

**주의**: `GOOGLE_SERVICE_ACCOUNT_KEY`는 JSON 파일의 내용 전체를 한 줄로 넣거나, 작은따옴표로 감싸야 할 수 있습니다. 배포 환경(Vercel)에서는 줄바꿈을 그대로 인식하지만, 로컬 `.env` 파일에서는 주의가 필요합니다. 가장 좋은 방법은 JSON 파일의 내용을 Base64로 인코딩해서 사용하는 것이지만, 이 프로젝트에서는 편의를 위해 JSON 내용을 그대로 붙여넣되, 줄바꿈 문제를 피하기 위해 **`private_key`의 `\n`을 실제 줄바꿈으로 변경하지 말고 문자열 그대로 두세요.**
