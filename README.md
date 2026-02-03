# GCal → Notion Sync

Google Calendar 일정을 Notion 데이터베이스로 자동 동기화하는 Next.js 애플리케이션입니다.

## 주요 기능

- Google Calendar의 모든 공유된 캘린더에서 일정 가져오기
- Notion 데이터베이스에 일정 자동 생성/수정/삭제
- 웹 대시보드를 통한 수동 동기화
- Vercel Cron을 통한 자동 스케줄 동기화 지원
- 과거 30일 ~ 미래 90일 범위 동기화

## 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build

# 테스트 실행
npm test
```

## 환경 변수 설정

`.env.example`을 복사하여 `.env` 파일을 생성하고 다음 값을 설정합니다:

```env
GOOGLE_SERVICE_ACCOUNT_KEY='{...}'  # GCP 서비스 계정 JSON 키
NOTION_KEY=secret_xxx               # Notion Integration 토큰
NOTION_DATABASE_ID=xxx              # 동기화할 Notion 데이터베이스 ID
CRON_SECRET=your-secret             # Cron 엔드포인트 인증용 시크릿
```

자세한 설정 방법은 [SETUP.md](./SETUP.md)를 참조하세요.

## API 엔드포인트

### POST /api/sync
수동으로 동기화를 트리거합니다.

```bash
curl -X POST http://localhost:3000/api/sync
```

### GET /api/cron/sync
Vercel Cron Job용 엔드포인트입니다. `CRON_SECRET` 인증이 필요합니다.

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/sync
```

## 프로젝트 구조

```
src/
├── app/
│   ├── api/
│   │   ├── sync/route.ts         # 수동 동기화 API
│   │   └── cron/sync/route.ts    # Cron용 동기화 API
│   ├── page.tsx                  # 대시보드 UI
│   ├── layout.tsx                # 앱 레이아웃
│   └── globals.css               # 글로벌 스타일
├── lib/
│   ├── google-calendar.ts        # Google Calendar API 클라이언트
│   ├── notion.ts                 # Notion API 클라이언트
│   ├── sync.ts                   # 동기화 로직
│   └── __tests__/                # 테스트 파일
└── types/
    ├── calendar.ts               # 캘린더 타입 정의
    └── notion.ts                 # Notion 타입 정의
```

## Vercel 배포

1. GitHub 레포지토리를 Vercel에 연결합니다.
2. 환경 변수를 Vercel 프로젝트 설정에 추가합니다.
3. `vercel.json`의 cron 설정으로 자동 동기화가 구성됩니다.

## 라이선스

MIT
