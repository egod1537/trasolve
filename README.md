# trasolve

TypeScript 기반 웹 프로젝트입니다. 아래 구조로 구성할 예정입니다.

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

현재는 README만 작성된 상태이며, 패키지 설정과 실행 코드는 아직 없습니다.
