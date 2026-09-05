# trasolve

Vite + 순수 TypeScript frontend와 Node.js HTTP backend를 사용하는 최소 웹 프로젝트입니다.

```text
trasolve/
├─ frontend/
│  ├─ src/
│  ├─ package.json
│  └─ tsconfig.json
├─ backend/
│  ├─ src/
│  ├─ package.json
│  └─ tsconfig.json
├─ shared/
│  ├─ types/
│  ├─ schemas/
│  ├─ constants/
│  ├─ index.ts
│  ├─ package.json
│  └─ tsconfig.json
├─ package.json
└─ tsconfig.json
```

- `frontend`: 웹 화면과 HTTP API 호출을 담당합니다.
- `backend`: HTTP API를 제공합니다.
- `shared`: 양쪽에서 사용하는 API 계약(타입, 스키마, 상수)만 둡니다.

## 기본 규칙

- frontend와 backend는 서로 직접 import하지 않고 HTTP API로만 통신합니다.
- shared는 frontend와 backend에 의존하지 않습니다.
- 각 패키지는 자체 `package.json`과 `tsconfig.json`을 가집니다.
- 루트에서 npm workspace로 세 패키지를 관리합니다.
- TypeScript path alias를 설정해 공통 계약을 `@trasolve/shared`로 import합니다.

`shared`는 Zod 스키마에서 응답 타입을 추론합니다. 비즈니스 로직이나 서버 전용 코드는 넣지 않습니다.
TypeScript alias는 shared의 빌드된 타입 선언을 가리키며, 실제 실행 시에는 npm workspace 연결과 shared의 `exports`로 같은 패키지를 찾습니다.

## 실행

Node.js 24 이상에서 프로젝트 루트에서 실행합니다.

```sh
npm install
npm run dev
```

- frontend: http://localhost:5173
- backend: http://127.0.0.1:3000/api/health

frontend는 `GET /api/health`를 호출하고 shared 스키마로 응답을 검증합니다.
Vite가 `/api` 요청을 backend로 프록시하므로 두 앱은 HTTP로만 통신합니다.
개발 명령은 shared를 먼저 빌드하고 세 패키지의 변경 감시를 함께 시작합니다.
종료하려면 `Ctrl+C`를 누릅니다.

## 검증 및 빌드

```sh
npm run typecheck
npm run build
```

빌드 결과는 각 패키지의 `dist/`에 생성됩니다.
개별 패키지 명령을 직접 실행할 때는 먼저 `npm run build -w @trasolve/shared`를 실행합니다.

빌드 결과를 로컬에서 확인하려면 두 터미널에서 각각 실행합니다.

```sh
npm run start -w @trasolve/backend
npm run preview -w @trasolve/frontend
```

미리보기 주소는 http://localhost:4173 입니다.
실제 배포에서는 frontend 정적 파일을 제공하고 `/api`를 backend로 전달하도록 웹 서버를 설정합니다.
