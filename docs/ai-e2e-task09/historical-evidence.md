# 기존 T3 원문 보존 및 결과 인덱스

2026-11-01 읽기 전용 snapshot. 이 내용은 과거 OpenWebUI/qwen 실행과 당시 runner이며 GPT 또는 현재 child의 실행 결과가 아니다. 원본 case/request/before/after/rawOutput/실패/latency를 생략하지 않는다. 원본 runner는 실행 금지 참고 원문으로만 보존하며 테스트 코드 파일이나 helper로 추가하지 않는다.

참조 root: `/Users/harryrha/orca/workspaces/trasolve/feat-ai-tripcommand-generation-execution`. 확인된 evidence ID는 16개이고 23-case draft 원문은 별도 locator가 필요하다.

## docs/trip-command-t3-evidence-qwen3.5-2b.json

SHA256: `37b88f49bddc8c12739f0235782ecf68e93cae4d241d9a9968906a7db0cc8ec7`; bytes: 116539.

| ID | 원 요청 | 과거 상태 | 오류/수정 |
| --- | --- | --- | --- |
| T3-S05 | 2일차에 아사쿠사를 추가해줘. | BLOCKED | EXTERNAL_PLACE_SOURCE_BLOCKED: GOOGLE_PLACES_API_KEY is missing. |
| T3-C1 | 2일차에 아사쿠사를 추가하고 오후 2시부터 90분 머물게 해줘. | BLOCKED | EXTERNAL_PLACE_SOURCE_BLOCKED: GOOGLE_PLACES_API_KEY is missing. |
| T3-S01 | 여행 이름을 T3 검증 여행 완료로 바꿔줘. | PASS |  |
| T3-S02 | 새로운 3일차를 추가해줘. | PASS |  |
| T3-S03 | 2일차 이름을 둘째 날로 바꿔줘. | PASS |  |
| T3-S04 | 3일차를 맨 앞으로 옮겨줘. | PASS |  |
| T3-S06 | 1일차의 우에노 공원을 삭제해줘. | PASS |  |
| T3-S07 | 1일차의 시부야를 2일차 마지막으로 옮겨줘. | FAIL | MODEL_GENERATION_FAILURE: Expected operations move_place but received move_day. |
| T3-S08 | 1일차의 시부야 이름을 시부야 스카이로 바꿔줘. | PASS |  |
| T3-S09 | 1일차의 시부야 메모를 야경으로 설정해줘. | PASS |  |
| T3-S10 | 1일차의 시부야 방문 시작 시간을 오후 2시로 바꿔줘. | PASS |  |
| T3-S11 | 1일차의 시부야 방문 시간을 90분으로 바꿔줘. | FAIL | PARSER_SCHEMA_FAILURE: schema_invalid: MODEL_RESPONSE_FAILED_TRIP_COMMAND_PLAN_SCHEMA |
| T3-S12 | 1일차의 시부야 선호 체류 시간을 120분으로 바꿔줘. | PASS |  |
| T3-S13 | 1일차의 시부야에서 도쿄 타워로 이어지는 경로를 도보 모드로 바꿔줘. | PASS |  |
| T3-C2 | 시부야를 1일차에서 2일차 마지막으로 옮기고 메모에 야경이라고 적어줘. | FAIL | PARSER_SCHEMA_FAILURE: json_parse: MODEL_RESPONSE_IS_NOT_ONE_JSON_DOCUMENT |
| T3-C3 | 3일차를 새로 만들고 이 장소 세 개를 그쪽으로 옮겨줘. | FAIL | PARSER_SCHEMA_FAILURE: json_parse: MODEL_RESPONSE_FORMAT_IS_NOT_RAW_JSON_OR_JSON_FENCE |

````json
{
  "contractVersion": "trip-command-plan/v1",
  "startedAt": "2026-10-05T07:00:15.846Z",
  "completedAt": "2026-10-05T07:04:42.852Z",
  "records": [
    {
      "scenarioId": "T3-S05",
      "request": "2일차에 아사쿠사를 추가해줘.",
      "before": null,
      "provider": "openwebui",
      "model": "qwen3.5:2b",
      "rawOutput": null,
      "commandSequence": [],
      "validation": "NOT_RUN",
      "preview": null,
      "execution": "NOT_RUN",
      "save": "NOT_RUN",
      "reload": "NOT_RUN",
      "after": null,
      "intentMatch": "NOT_RUN",
      "errorsFixes": [
        "EXTERNAL_PLACE_SOURCE_BLOCKED: GOOGLE_PLACES_API_KEY is missing."
      ],
      "latency": {
        "modelRequestMs": null,
        "prepareMs": null,
        "executeMs": null,
        "saveMs": null,
        "reloadMs": null,
        "totalMs": 0
      },
      "status": "BLOCKED"
    },
    {
      "scenarioId": "T3-C1",
      "request": "2일차에 아사쿠사를 추가하고 오후 2시부터 90분 머물게 해줘.",
      "before": null,
      "provider": "openwebui",
      "model": "qwen3.5:2b",
      "rawOutput": null,
      "commandSequence": [],
      "validation": "NOT_RUN",
      "preview": null,
      "execution": "NOT_RUN",
      "save": "NOT_RUN",
      "reload": "NOT_RUN",
      "after": null,
      "intentMatch": "NOT_RUN",
      "errorsFixes": [
        "EXTERNAL_PLACE_SOURCE_BLOCKED: GOOGLE_PLACES_API_KEY is missing."
      ],
      "latency": {
        "modelRequestMs": null,
        "prepareMs": null,
        "executeMs": null,
        "saveMs": null,
        "reloadMs": null,
        "totalMs": 0
      },
      "status": "BLOCKED"
    },
    {
      "scenarioId": "T3-S01",
      "request": "여행 이름을 T3 검증 여행 완료로 바꿔줘.",
      "before": {
        "id": "4d41988b-fb00-4a70-986e-f2579cafa4c0",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [],
        "createdAt": "2026-10-05T07:00:15.881Z",
        "updatedAt": "2026-10-05T07:00:15.881Z"
      },
      "provider": "openwebui",
      "model": "qwen3.5:2b",
      "rawOutput": "```json\n{\n  \"version\": 1,\n  \"base\": {\n    \"tripId\": \"4d41988b-fb00-4a70-986e-f2579cafa4c0\",\n    \"fingerprint\": \"sha256:5ee245a4fde32739636a591e33e41bf9991996ce8cac09252dd0bbe1e9b77851\"\n  },\n  \"operations\": [\n    {\n      \"stepId\": \"s1\",\n      \"op\": \"rename_trip\",\n      \"title\": \"T3 검증 여행 완료\"\n    }\n  ]\n}\n```",
      "commandSequence": [
        {
          "stepId": "s1",
          "op": "rename_trip",
          "title": "T3 검증 여행 완료"
        }
      ],
      "validation": "PASS",
      "preview": {
        "operationCount": 1,
        "commandCount": 2,
        "diff": [
          {
            "op": "rename_trip",
            "before": "T3 Validation Trip",
            "after": "T3 검증 여행 완료"
          }
        ],
        "risk": {
          "characteristics": ["metadata_edit"]
        },
        "before": {
          "id": "4d41988b-fb00-4a70-986e-f2579cafa4c0",
          "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
          "title": "T3 Validation Trip",
          "days": [],
          "createdAt": "2026-10-05T07:00:15.881Z",
          "updatedAt": "2026-10-05T07:00:15.881Z"
        },
        "after": {
          "id": "4d41988b-fb00-4a70-986e-f2579cafa4c0",
          "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
          "title": "T3 검증 여행 완료",
          "days": [],
          "createdAt": "2026-10-05T07:00:15.881Z",
          "updatedAt": "2026-10-05T07:00:15.881Z"
        }
      },
      "execution": "PASS",
      "save": "PASS",
      "reload": "PASS",
      "after": {
        "id": "4d41988b-fb00-4a70-986e-f2579cafa4c0",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 검증 여행 완료",
        "days": [],
        "createdAt": "2026-10-05T07:00:15.881Z",
        "updatedAt": "2026-10-05T07:00:25.750Z"
      },
      "intentMatch": "PASS",
      "errorsFixes": [],
      "latency": {
        "modelRequestMs": 9822,
        "prepareMs": 1.600000023841858,
        "executeMs": 0.6000000238418579,
        "saveMs": 19.600000023841858,
        "reloadMs": 4.299999952316284,
        "totalMs": 9918.700000047684
      },
      "status": "PASS"
    },
    {
      "scenarioId": "T3-S02",
      "request": "새로운 3일차를 추가해줘.",
      "before": {
        "id": "61947318-f94a-4f46-8ec0-aac27169d4fb",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "037c3c03-d160-4810-a755-c3dab464a9bd",
            "title": "1일차",
            "color": "#2563eb",
            "places": [],
            "polylines": [],
            "layerItems": []
          },
          {
            "id": "dd37319f-dbbb-4cdb-b80d-70806bf6ee4a",
            "title": "2일차",
            "color": "#2563eb",
            "places": [],
            "polylines": [],
            "layerItems": []
          }
        ],
        "createdAt": "2026-10-05T07:04:36.810Z",
        "updatedAt": "2026-10-05T07:04:36.810Z"
      },
      "provider": "openwebui",
      "model": "qwen3.5:2b",
      "rawOutput": "{\"version\":1,\"base\":{\"tripId\":\"61947318-f94a-4f46-8ec0-aac27169d4fb\",\"fingerprint\":\"sha256:6e82013e382eb5230764822973f2a7bfaa6d3fc2be0c4fe650bbd75021029285\"},\"operations\":[{\"stepId\":\"s1\",\"op\":\"add_day\",\"title\":\"새로운 3일차 추가\"}]}",
      "commandSequence": [
        {
          "stepId": "s1",
          "op": "add_day",
          "title": "새로운 3일차 추가"
        }
      ],
      "validation": "PASS",
      "preview": {
        "operationCount": 1,
        "commandCount": 2,
        "diff": [
          {
            "op": "add_day",
            "dayId": "pending-923073af-9853-469c-8c3a-4439566eaf27",
            "title": "새로운 3일차 추가",
            "index": 2
          }
        ],
        "risk": {
          "characteristics": ["structural_change"]
        },
        "before": {
          "id": "61947318-f94a-4f46-8ec0-aac27169d4fb",
          "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
          "title": "T3 Validation Trip",
          "days": [
            {
              "id": "037c3c03-d160-4810-a755-c3dab464a9bd",
              "title": "1일차",
              "color": "#2563eb",
              "places": [],
              "polylines": [],
              "layerItems": []
            },
            {
              "id": "dd37319f-dbbb-4cdb-b80d-70806bf6ee4a",
              "title": "2일차",
              "color": "#2563eb",
              "places": [],
              "polylines": [],
              "layerItems": []
            }
          ],
          "createdAt": "2026-10-05T07:04:36.810Z",
          "updatedAt": "2026-10-05T07:04:36.810Z"
        },
        "after": {
          "id": "61947318-f94a-4f46-8ec0-aac27169d4fb",
          "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
          "title": "T3 Validation Trip",
          "days": [
            {
              "id": "037c3c03-d160-4810-a755-c3dab464a9bd",
              "title": "1일차",
              "color": "#2563eb",
              "places": [],
              "polylines": [],
              "layerItems": []
            },
            {
              "id": "dd37319f-dbbb-4cdb-b80d-70806bf6ee4a",
              "title": "2일차",
              "color": "#2563eb",
              "places": [],
              "polylines": [],
              "layerItems": []
            },
            {
              "id": "pending-923073af-9853-469c-8c3a-4439566eaf27",
              "title": "새로운 3일차 추가",
              "color": "#ca8a04",
              "places": [],
              "polylines": [],
              "layerItems": []
            }
          ],
          "createdAt": "2026-10-05T07:04:36.810Z",
          "updatedAt": "2026-10-05T07:04:36.810Z"
        }
      },
      "execution": "PASS",
      "save": "PASS",
      "reload": "PASS",
      "after": {
        "id": "61947318-f94a-4f46-8ec0-aac27169d4fb",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "037c3c03-d160-4810-a755-c3dab464a9bd",
            "title": "1일차",
            "color": "#2563eb",
            "places": [],
            "polylines": [],
            "layerItems": []
          },
          {
            "id": "dd37319f-dbbb-4cdb-b80d-70806bf6ee4a",
            "title": "2일차",
            "color": "#2563eb",
            "places": [],
            "polylines": [],
            "layerItems": []
          },
          {
            "id": "b6d529cb-ce5c-4af4-bc6a-61b467b61e78",
            "title": "새로운 3일차 추가",
            "color": "#ea580c",
            "places": [],
            "polylines": [],
            "layerItems": []
          }
        ],
        "createdAt": "2026-10-05T07:04:36.810Z",
        "updatedAt": "2026-10-05T07:04:42.839Z"
      },
      "intentMatch": "PASS",
      "errorsFixes": [],
      "latency": {
        "modelRequestMs": 5981.899999976158,
        "prepareMs": 1.3000000715255737,
        "executeMs": 1.2999999523162842,
        "saveMs": 10.5,
        "reloadMs": 1.8000000715255737,
        "totalMs": 6060.700000047684
      },
      "status": "PASS"
    },
    {
      "scenarioId": "T3-S03",
      "request": "2일차 이름을 둘째 날로 바꿔줘.",
      "before": {
        "id": "74477db0-88c9-4eb9-91dd-82b801a388cb",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "e2bf2e51-de3c-4a80-82ef-6c1e8b195d1e",
            "title": "1일차",
            "color": "#2563eb",
            "places": [],
            "polylines": [],
            "layerItems": []
          },
          {
            "id": "b51ce4d9-d5ad-44a6-9c67-efd6b6805f4b",
            "title": "2일차",
            "color": "#2563eb",
            "places": [],
            "polylines": [],
            "layerItems": []
          }
        ],
        "createdAt": "2026-10-05T07:00:31.581Z",
        "updatedAt": "2026-10-05T07:00:31.581Z"
      },
      "provider": "openwebui",
      "model": "qwen3.5:2b",
      "rawOutput": "{\"version\":1,\"base\":{\"tripId\":\"74477db0-88c9-4eb9-91dd-82b801a388cb\",\"fingerprint\":\"sha256:3c2e94f39a0979318a5c5483a3170fc1bff5f40f29455ad1c0119dd82d6395e7\"},\"operations\":[{\"stepId\":\"s1\",\"op\":\"rename_day\",\"day\":{\"kind\":\"id\",\"id\":\"b51ce4d9-d5ad-44a6-9c67-efd6b6805f4b\"},\"title\":\"둘째 날\"}]}",
      "commandSequence": [
        {
          "stepId": "s1",
          "op": "rename_day",
          "day": {
            "kind": "id",
            "id": "b51ce4d9-d5ad-44a6-9c67-efd6b6805f4b"
          },
          "title": "둘째 날"
        }
      ],
      "validation": "PASS",
      "preview": {
        "operationCount": 1,
        "commandCount": 2,
        "diff": [
          {
            "op": "rename_day",
            "dayId": "b51ce4d9-d5ad-44a6-9c67-efd6b6805f4b",
            "before": "2일차",
            "after": "둘째 날"
          }
        ],
        "risk": {
          "characteristics": ["metadata_edit"]
        },
        "before": {
          "id": "74477db0-88c9-4eb9-91dd-82b801a388cb",
          "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
          "title": "T3 Validation Trip",
          "days": [
            {
              "id": "e2bf2e51-de3c-4a80-82ef-6c1e8b195d1e",
              "title": "1일차",
              "color": "#2563eb",
              "places": [],
              "polylines": [],
              "layerItems": []
            },
            {
              "id": "b51ce4d9-d5ad-44a6-9c67-efd6b6805f4b",
              "title": "2일차",
              "color": "#2563eb",
              "places": [],
              "polylines": [],
              "layerItems": []
            }
          ],
          "createdAt": "2026-10-05T07:00:31.581Z",
          "updatedAt": "2026-10-05T07:00:31.581Z"
        },
        "after": {
          "id": "74477db0-88c9-4eb9-91dd-82b801a388cb",
          "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
          "title": "T3 Validation Trip",
          "days": [
            {
              "id": "e2bf2e51-de3c-4a80-82ef-6c1e8b195d1e",
              "title": "1일차",
              "color": "#2563eb",
              "places": [],
              "polylines": [],
              "layerItems": []
            },
            {
              "id": "b51ce4d9-d5ad-44a6-9c67-efd6b6805f4b",
              "title": "둘째 날",
              "color": "#2563eb",
              "places": [],
              "polylines": [],
              "layerItems": []
            }
          ],
          "createdAt": "2026-10-05T07:00:31.581Z",
          "updatedAt": "2026-10-05T07:00:31.581Z"
        }
      },
      "execution": "PASS",
      "save": "PASS",
      "reload": "PASS",
      "after": {
        "id": "74477db0-88c9-4eb9-91dd-82b801a388cb",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "e2bf2e51-de3c-4a80-82ef-6c1e8b195d1e",
            "title": "1일차",
            "color": "#2563eb",
            "places": [],
            "polylines": [],
            "layerItems": []
          },
          {
            "id": "b51ce4d9-d5ad-44a6-9c67-efd6b6805f4b",
            "title": "둘째 날",
            "color": "#2563eb",
            "places": [],
            "polylines": [],
            "layerItems": []
          }
        ],
        "createdAt": "2026-10-05T07:00:31.581Z",
        "updatedAt": "2026-10-05T07:00:38.859Z"
      },
      "intentMatch": "PASS",
      "errorsFixes": [],
      "latency": {
        "modelRequestMs": 7238,
        "prepareMs": 1.100000023841858,
        "executeMs": 0.8000000715255737,
        "saveMs": 13.899999976158142,
        "reloadMs": 2,
        "totalMs": 7291.5
      },
      "status": "PASS"
    },
    {
      "scenarioId": "T3-S04",
      "request": "3일차를 맨 앞으로 옮겨줘.",
      "before": {
        "id": "53e73646-a47c-4044-b634-065ae97041d3",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "0ccce64a-e5b3-463e-a19f-f992011b1757",
            "title": "1일차",
            "color": "#2563eb",
            "places": [],
            "polylines": [],
            "layerItems": []
          },
          {
            "id": "d01cb4ef-959c-4d29-befe-1955bd360060",
            "title": "2일차",
            "color": "#2563eb",
            "places": [],
            "polylines": [],
            "layerItems": []
          },
          {
            "id": "ea7a77d7-7927-4943-b976-82d05050ca9b",
            "title": "3일차",
            "color": "#2563eb",
            "places": [],
            "polylines": [],
            "layerItems": []
          }
        ],
        "createdAt": "2026-10-05T07:00:38.873Z",
        "updatedAt": "2026-10-05T07:00:38.873Z"
      },
      "provider": "openwebui",
      "model": "qwen3.5:2b",
      "rawOutput": "{\"version\":1,\"base\":{\"tripId\":\"53e73646-a47c-4044-b634-065ae97041d3\",\"fingerprint\":\"sha256:9473ff903f8aefb5c31044bd93e85eafd0670ab306b36d53f378e1ae1a656263\"},\"operations\":[{\"stepId\":\"s1\",\"op\":\"move_day\",\"day\":{\"kind\":\"id\",\"id\":\"ea7a77d7-7927-4943-b976-82d05050ca9b\"},\"position\":{\"kind\":\"start\"}}]}",
      "commandSequence": [
        {
          "stepId": "s1",
          "op": "move_day",
          "day": {
            "kind": "id",
            "id": "ea7a77d7-7927-4943-b976-82d05050ca9b"
          },
          "position": {
            "kind": "start"
          }
        }
      ],
      "validation": "PASS",
      "preview": {
        "operationCount": 1,
        "commandCount": 2,
        "diff": [
          {
            "op": "move_day",
            "dayId": "ea7a77d7-7927-4943-b976-82d05050ca9b",
            "beforeIndex": 2,
            "afterIndex": 0
          },
          {
            "op": "move_day",
            "dayId": "0ccce64a-e5b3-463e-a19f-f992011b1757",
            "beforeIndex": 0,
            "afterIndex": 1
          },
          {
            "op": "move_day",
            "dayId": "d01cb4ef-959c-4d29-befe-1955bd360060",
            "beforeIndex": 1,
            "afterIndex": 2
          }
        ],
        "risk": {
          "characteristics": ["structural_change"]
        },
        "before": {
          "id": "53e73646-a47c-4044-b634-065ae97041d3",
          "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
          "title": "T3 Validation Trip",
          "days": [
            {
              "id": "0ccce64a-e5b3-463e-a19f-f992011b1757",
              "title": "1일차",
              "color": "#2563eb",
              "places": [],
              "polylines": [],
              "layerItems": []
            },
            {
              "id": "d01cb4ef-959c-4d29-befe-1955bd360060",
              "title": "2일차",
              "color": "#2563eb",
              "places": [],
              "polylines": [],
              "layerItems": []
            },
            {
              "id": "ea7a77d7-7927-4943-b976-82d05050ca9b",
              "title": "3일차",
              "color": "#2563eb",
              "places": [],
              "polylines": [],
              "layerItems": []
            }
          ],
          "createdAt": "2026-10-05T07:00:38.873Z",
          "updatedAt": "2026-10-05T07:00:38.873Z"
        },
        "after": {
          "id": "53e73646-a47c-4044-b634-065ae97041d3",
          "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
          "title": "T3 Validation Trip",
          "days": [
            {
              "id": "ea7a77d7-7927-4943-b976-82d05050ca9b",
              "title": "3일차",
              "color": "#2563eb",
              "places": [],
              "polylines": [],
              "layerItems": []
            },
            {
              "id": "0ccce64a-e5b3-463e-a19f-f992011b1757",
              "title": "1일차",
              "color": "#2563eb",
              "places": [],
              "polylines": [],
              "layerItems": []
            },
            {
              "id": "d01cb4ef-959c-4d29-befe-1955bd360060",
              "title": "2일차",
              "color": "#2563eb",
              "places": [],
              "polylines": [],
              "layerItems": []
            }
          ],
          "createdAt": "2026-10-05T07:00:38.873Z",
          "updatedAt": "2026-10-05T07:00:38.873Z"
        }
      },
      "execution": "PASS",
      "save": "PASS",
      "reload": "PASS",
      "after": {
        "id": "53e73646-a47c-4044-b634-065ae97041d3",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "ea7a77d7-7927-4943-b976-82d05050ca9b",
            "title": "3일차",
            "color": "#2563eb",
            "places": [],
            "polylines": [],
            "layerItems": []
          },
          {
            "id": "0ccce64a-e5b3-463e-a19f-f992011b1757",
            "title": "1일차",
            "color": "#2563eb",
            "places": [],
            "polylines": [],
            "layerItems": []
          },
          {
            "id": "d01cb4ef-959c-4d29-befe-1955bd360060",
            "title": "2일차",
            "color": "#2563eb",
            "places": [],
            "polylines": [],
            "layerItems": []
          }
        ],
        "createdAt": "2026-10-05T07:00:38.873Z",
        "updatedAt": "2026-10-05T07:00:45.891Z"
      },
      "intentMatch": "PASS",
      "errorsFixes": [],
      "latency": {
        "modelRequestMs": 6983.099999904633,
        "prepareMs": 1.899999976158142,
        "executeMs": 1.100000023841858,
        "saveMs": 10.099999904632568,
        "reloadMs": 1.8000000715255737,
        "totalMs": 7029
      },
      "status": "PASS"
    },
    {
      "scenarioId": "T3-S06",
      "request": "1일차의 우에노 공원을 삭제해줘.",
      "before": {
        "id": "a8b6461b-4821-4167-88a6-8744415cc43e",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "0d635d8c-53c2-4280-875a-070a741be866",
            "title": "1일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "7e67dfaa-28b9-4558-a54b-b7df684abe62",
                "placeId": "fixture-place-shibuya",
                "name": "시부야",
                "location": {
                  "lat": 35.6595,
                  "lng": 139.7005
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              },
              {
                "id": "9321729f-5419-4c81-bfaa-1e75d49f3454",
                "placeId": "fixture-place-ueno",
                "name": "우에노 공원",
                "location": {
                  "lat": 35.7148,
                  "lng": 139.7732
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 2
              }
            ],
            "polylines": [
              {
                "id": "cfa81d71-6d7f-45bd-802e-616ebef2ab13",
                "fromPlaceId": "7e67dfaa-28b9-4558-a54b-b7df684abe62",
                "toPlaceId": "9321729f-5419-4c81-bfaa-1e75d49f3454",
                "mode": "straight",
                "order": 1
              }
            ],
            "layerItems": [
              {
                "type": "place",
                "id": "7e67dfaa-28b9-4558-a54b-b7df684abe62"
              },
              {
                "type": "polyline",
                "id": "cfa81d71-6d7f-45bd-802e-616ebef2ab13"
              },
              {
                "type": "place",
                "id": "9321729f-5419-4c81-bfaa-1e75d49f3454"
              }
            ]
          },
          {
            "id": "add4a57f-a30b-481c-9b72-92c727bc9bad",
            "title": "2일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "691c11b7-0976-46f7-8ac5-44e2733cee12",
                "placeId": "fixture-place-tower",
                "name": "도쿄 타워",
                "location": {
                  "lat": 35.6586,
                  "lng": 139.7454
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              }
            ],
            "polylines": [],
            "layerItems": [
              {
                "type": "place",
                "id": "691c11b7-0976-46f7-8ac5-44e2733cee12"
              }
            ]
          }
        ],
        "createdAt": "2026-10-05T07:00:45.903Z",
        "updatedAt": "2026-10-05T07:00:45.903Z"
      },
      "provider": "openwebui",
      "model": "qwen3.5:2b",
      "rawOutput": "{\"version\":1,\"base\":{\"tripId\":\"a8b6461b-4821-4167-88a6-8744415cc43e\",\"fingerprint\":\"sha256:01d42e0dc62860c0c7685517c0063c3b837a64fed8fdfea273ae1a7b42dea15c\"},\"operations\":[{\"stepId\":\"s1\",\"op\":\"remove_place\",\"place\":{\"kind\":\"id\",\"id\":\"9321729f-5419-4c81-bfaa-1e75d49f3454\"}}]}",
      "commandSequence": [
        {
          "stepId": "s1",
          "op": "remove_place",
          "place": {
            "kind": "id",
            "id": "9321729f-5419-4c81-bfaa-1e75d49f3454"
          }
        }
      ],
      "validation": "PASS",
      "preview": {
        "operationCount": 1,
        "commandCount": 2,
        "diff": [
          {
            "op": "remove_place",
            "placeId": "9321729f-5419-4c81-bfaa-1e75d49f3454",
            "dayId": "0d635d8c-53c2-4280-875a-070a741be866",
            "index": 1,
            "name": "우에노 공원"
          }
        ],
        "risk": {
          "characteristics": ["destructive_removal"]
        },
        "before": {
          "id": "a8b6461b-4821-4167-88a6-8744415cc43e",
          "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
          "title": "T3 Validation Trip",
          "days": [
            {
              "id": "0d635d8c-53c2-4280-875a-070a741be866",
              "title": "1일차",
              "color": "#2563eb",
              "places": [
                {
                  "id": "7e67dfaa-28b9-4558-a54b-b7df684abe62",
                  "placeId": "fixture-place-shibuya",
                  "name": "시부야",
                  "location": {
                    "lat": 35.6595,
                    "lng": 139.7005
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 1
                },
                {
                  "id": "9321729f-5419-4c81-bfaa-1e75d49f3454",
                  "placeId": "fixture-place-ueno",
                  "name": "우에노 공원",
                  "location": {
                    "lat": 35.7148,
                    "lng": 139.7732
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 2
                }
              ],
              "polylines": [
                {
                  "id": "cfa81d71-6d7f-45bd-802e-616ebef2ab13",
                  "fromPlaceId": "7e67dfaa-28b9-4558-a54b-b7df684abe62",
                  "toPlaceId": "9321729f-5419-4c81-bfaa-1e75d49f3454",
                  "mode": "straight",
                  "order": 1
                }
              ],
              "layerItems": [
                {
                  "type": "place",
                  "id": "7e67dfaa-28b9-4558-a54b-b7df684abe62"
                },
                {
                  "type": "polyline",
                  "id": "cfa81d71-6d7f-45bd-802e-616ebef2ab13"
                },
                {
                  "type": "place",
                  "id": "9321729f-5419-4c81-bfaa-1e75d49f3454"
                }
              ]
            },
            {
              "id": "add4a57f-a30b-481c-9b72-92c727bc9bad",
              "title": "2일차",
              "color": "#2563eb",
              "places": [
                {
                  "id": "691c11b7-0976-46f7-8ac5-44e2733cee12",
                  "placeId": "fixture-place-tower",
                  "name": "도쿄 타워",
                  "location": {
                    "lat": 35.6586,
                    "lng": 139.7454
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 1
                }
              ],
              "polylines": [],
              "layerItems": [
                {
                  "type": "place",
                  "id": "691c11b7-0976-46f7-8ac5-44e2733cee12"
                }
              ]
            }
          ],
          "createdAt": "2026-10-05T07:00:45.903Z",
          "updatedAt": "2026-10-05T07:00:45.903Z"
        },
        "after": {
          "id": "a8b6461b-4821-4167-88a6-8744415cc43e",
          "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
          "title": "T3 Validation Trip",
          "days": [
            {
              "id": "0d635d8c-53c2-4280-875a-070a741be866",
              "title": "1일차",
              "color": "#2563eb",
              "places": [
                {
                  "id": "7e67dfaa-28b9-4558-a54b-b7df684abe62",
                  "placeId": "fixture-place-shibuya",
                  "name": "시부야",
                  "location": {
                    "lat": 35.6595,
                    "lng": 139.7005
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 1
                }
              ],
              "polylines": [],
              "layerItems": [
                {
                  "type": "place",
                  "id": "7e67dfaa-28b9-4558-a54b-b7df684abe62"
                }
              ]
            },
            {
              "id": "add4a57f-a30b-481c-9b72-92c727bc9bad",
              "title": "2일차",
              "color": "#2563eb",
              "places": [
                {
                  "id": "691c11b7-0976-46f7-8ac5-44e2733cee12",
                  "placeId": "fixture-place-tower",
                  "name": "도쿄 타워",
                  "location": {
                    "lat": 35.6586,
                    "lng": 139.7454
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 1
                }
              ],
              "polylines": [],
              "layerItems": [
                {
                  "type": "place",
                  "id": "691c11b7-0976-46f7-8ac5-44e2733cee12"
                }
              ]
            }
          ],
          "createdAt": "2026-10-05T07:00:45.903Z",
          "updatedAt": "2026-10-05T07:00:45.903Z"
        }
      },
      "execution": "PASS",
      "save": "PASS",
      "reload": "PASS",
      "after": {
        "id": "a8b6461b-4821-4167-88a6-8744415cc43e",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "0d635d8c-53c2-4280-875a-070a741be866",
            "title": "1일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "7e67dfaa-28b9-4558-a54b-b7df684abe62",
                "placeId": "fixture-place-shibuya",
                "name": "시부야",
                "location": {
                  "lat": 35.6595,
                  "lng": 139.7005
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              }
            ],
            "polylines": [],
            "layerItems": [
              {
                "type": "place",
                "id": "7e67dfaa-28b9-4558-a54b-b7df684abe62"
              }
            ]
          },
          {
            "id": "add4a57f-a30b-481c-9b72-92c727bc9bad",
            "title": "2일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "691c11b7-0976-46f7-8ac5-44e2733cee12",
                "placeId": "fixture-place-tower",
                "name": "도쿄 타워",
                "location": {
                  "lat": 35.6586,
                  "lng": 139.7454
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              }
            ],
            "polylines": [],
            "layerItems": [
              {
                "type": "place",
                "id": "691c11b7-0976-46f7-8ac5-44e2733cee12"
              }
            ]
          }
        ],
        "createdAt": "2026-10-05T07:00:45.903Z",
        "updatedAt": "2026-10-05T07:00:53.379Z"
      },
      "intentMatch": "PASS",
      "errorsFixes": [],
      "latency": {
        "modelRequestMs": 7446.700000047684,
        "prepareMs": 0.8999999761581421,
        "executeMs": 0.40000009536743164,
        "saveMs": 17.90000009536743,
        "reloadMs": 2.6999999284744263,
        "totalMs": 7497.5
      },
      "status": "PASS"
    },
    {
      "scenarioId": "T3-S07",
      "request": "1일차의 시부야를 2일차 마지막으로 옮겨줘.",
      "before": {
        "id": "a7265e7d-e271-4728-bd11-52200633914c",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "332e3812-67c6-4b9a-972a-6ad151c1604c",
            "title": "1일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "09a04c28-c572-48a5-bbca-15126e7f084f",
                "placeId": "fixture-place-shibuya",
                "name": "시부야",
                "location": {
                  "lat": 35.6595,
                  "lng": 139.7005
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              },
              {
                "id": "21a66dcf-1f1c-4063-9d21-5a39f3a59684",
                "placeId": "fixture-place-ueno",
                "name": "우에노 공원",
                "location": {
                  "lat": 35.7148,
                  "lng": 139.7732
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 2
              }
            ],
            "polylines": [
              {
                "id": "7ba772be-cdb1-432f-8cad-202ebcd632d5",
                "fromPlaceId": "09a04c28-c572-48a5-bbca-15126e7f084f",
                "toPlaceId": "21a66dcf-1f1c-4063-9d21-5a39f3a59684",
                "mode": "straight",
                "order": 1
              }
            ],
            "layerItems": [
              {
                "type": "place",
                "id": "09a04c28-c572-48a5-bbca-15126e7f084f"
              },
              {
                "type": "polyline",
                "id": "7ba772be-cdb1-432f-8cad-202ebcd632d5"
              },
              {
                "type": "place",
                "id": "21a66dcf-1f1c-4063-9d21-5a39f3a59684"
              }
            ]
          },
          {
            "id": "333bc351-d3b2-415d-ad27-381e13353956",
            "title": "2일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "97254535-f9d7-4a5d-a756-bc979e51eb2b",
                "placeId": "fixture-place-tower",
                "name": "도쿄 타워",
                "location": {
                  "lat": 35.6586,
                  "lng": 139.7454
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              }
            ],
            "polylines": [],
            "layerItems": [
              {
                "type": "place",
                "id": "97254535-f9d7-4a5d-a756-bc979e51eb2b"
              }
            ]
          }
        ],
        "createdAt": "2026-10-05T07:00:53.400Z",
        "updatedAt": "2026-10-05T07:00:53.400Z"
      },
      "provider": "openwebui",
      "model": "qwen3.5:2b",
      "rawOutput": "{\"version\":1,\"base\":{\"tripId\":\"a7265e7d-e271-4728-bd11-52200633914c\",\"fingerprint\":\"sha256:075071dda8c81454d2d5634aadf2c302b6a9c0b59bffee3a9eff8b1b263f5de3\"},\"operations\":[{\"stepId\":\"s1\",\"op\":\"move_day\",\"day\":{\"kind\":\"id\",\"id\":\"333bc351-d3b2-415d-ad27-381e13353956\"},\"position\":{\"kind\":\"end\"}}]}",
      "commandSequence": [
        {
          "stepId": "s1",
          "op": "move_day",
          "day": {
            "kind": "id",
            "id": "333bc351-d3b2-415d-ad27-381e13353956"
          },
          "position": {
            "kind": "end"
          }
        }
      ],
      "validation": "NOT_RUN",
      "preview": null,
      "execution": "NOT_RUN",
      "save": "NOT_RUN",
      "reload": "NOT_RUN",
      "after": null,
      "intentMatch": "NOT_RUN",
      "errorsFixes": [
        "MODEL_GENERATION_FAILURE: Expected operations move_place but received move_day."
      ],
      "latency": {
        "modelRequestMs": 7854.899999976158,
        "prepareMs": null,
        "executeMs": null,
        "saveMs": null,
        "reloadMs": null,
        "totalMs": 7876
      },
      "status": "FAIL"
    },
    {
      "scenarioId": "T3-S08",
      "request": "1일차의 시부야 이름을 시부야 스카이로 바꿔줘.",
      "before": {
        "id": "58f03fa5-92db-40b1-a079-f5bee207168f",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "177d8f48-dca4-45bd-9e95-c713f53180b1",
            "title": "1일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "1ce589b3-eb83-461d-b672-0d3657fddc76",
                "placeId": "fixture-place-shibuya",
                "name": "시부야",
                "location": {
                  "lat": 35.6595,
                  "lng": 139.7005
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              },
              {
                "id": "57802cde-12b7-4eee-8a77-49c9082784f0",
                "placeId": "fixture-place-ueno",
                "name": "우에노 공원",
                "location": {
                  "lat": 35.7148,
                  "lng": 139.7732
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 2
              }
            ],
            "polylines": [
              {
                "id": "fa47903d-0fbd-426a-992b-04b92e6ea531",
                "fromPlaceId": "1ce589b3-eb83-461d-b672-0d3657fddc76",
                "toPlaceId": "57802cde-12b7-4eee-8a77-49c9082784f0",
                "mode": "straight",
                "order": 1
              }
            ],
            "layerItems": [
              {
                "type": "place",
                "id": "1ce589b3-eb83-461d-b672-0d3657fddc76"
              },
              {
                "type": "polyline",
                "id": "fa47903d-0fbd-426a-992b-04b92e6ea531"
              },
              {
                "type": "place",
                "id": "57802cde-12b7-4eee-8a77-49c9082784f0"
              }
            ]
          },
          {
            "id": "f672e76d-9428-4be3-836d-2c08443ebd9f",
            "title": "2일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "0a828c0d-b714-4e35-b980-2c9d185b7a6b",
                "placeId": "fixture-place-tower",
                "name": "도쿄 타워",
                "location": {
                  "lat": 35.6586,
                  "lng": 139.7454
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              }
            ],
            "polylines": [],
            "layerItems": [
              {
                "type": "place",
                "id": "0a828c0d-b714-4e35-b980-2c9d185b7a6b"
              }
            ]
          }
        ],
        "createdAt": "2026-10-05T07:01:01.280Z",
        "updatedAt": "2026-10-05T07:01:01.280Z"
      },
      "provider": "openwebui",
      "model": "qwen3.5:2b",
      "rawOutput": "{\"version\":1,\"base\":{\"tripId\":\"58f03fa5-92db-40b1-a079-f5bee207168f\",\"fingerprint\":\"sha256:4247ff44b5d1cbc67dfc75cd80a5081948f88fe817560525e0d2aa53401054be\"},\"operations\":[{\"stepId\":\"s1\",\"op\":\"rename_place\",\"place\":{\"kind\":\"id\",\"id\":\"1ce589b3-eb83-461d-b672-0d3657fddc76\"},\"name\":\"시부야 스카이\"}]}",
      "commandSequence": [
        {
          "stepId": "s1",
          "op": "rename_place",
          "place": {
            "kind": "id",
            "id": "1ce589b3-eb83-461d-b672-0d3657fddc76"
          },
          "name": "시부야 스카이"
        }
      ],
      "validation": "PASS",
      "preview": {
        "operationCount": 1,
        "commandCount": 2,
        "diff": [
          {
            "op": "rename_place",
            "placeId": "1ce589b3-eb83-461d-b672-0d3657fddc76",
            "before": "시부야",
            "after": "시부야 스카이"
          }
        ],
        "risk": {
          "characteristics": ["metadata_edit"]
        },
        "before": {
          "id": "58f03fa5-92db-40b1-a079-f5bee207168f",
          "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
          "title": "T3 Validation Trip",
          "days": [
            {
              "id": "177d8f48-dca4-45bd-9e95-c713f53180b1",
              "title": "1일차",
              "color": "#2563eb",
              "places": [
                {
                  "id": "1ce589b3-eb83-461d-b672-0d3657fddc76",
                  "placeId": "fixture-place-shibuya",
                  "name": "시부야",
                  "location": {
                    "lat": 35.6595,
                    "lng": 139.7005
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 1
                },
                {
                  "id": "57802cde-12b7-4eee-8a77-49c9082784f0",
                  "placeId": "fixture-place-ueno",
                  "name": "우에노 공원",
                  "location": {
                    "lat": 35.7148,
                    "lng": 139.7732
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 2
                }
              ],
              "polylines": [
                {
                  "id": "fa47903d-0fbd-426a-992b-04b92e6ea531",
                  "fromPlaceId": "1ce589b3-eb83-461d-b672-0d3657fddc76",
                  "toPlaceId": "57802cde-12b7-4eee-8a77-49c9082784f0",
                  "mode": "straight",
                  "order": 1
                }
              ],
              "layerItems": [
                {
                  "type": "place",
                  "id": "1ce589b3-eb83-461d-b672-0d3657fddc76"
                },
                {
                  "type": "polyline",
                  "id": "fa47903d-0fbd-426a-992b-04b92e6ea531"
                },
                {
                  "type": "place",
                  "id": "57802cde-12b7-4eee-8a77-49c9082784f0"
                }
              ]
            },
            {
              "id": "f672e76d-9428-4be3-836d-2c08443ebd9f",
              "title": "2일차",
              "color": "#2563eb",
              "places": [
                {
                  "id": "0a828c0d-b714-4e35-b980-2c9d185b7a6b",
                  "placeId": "fixture-place-tower",
                  "name": "도쿄 타워",
                  "location": {
                    "lat": 35.6586,
                    "lng": 139.7454
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 1
                }
              ],
              "polylines": [],
              "layerItems": [
                {
                  "type": "place",
                  "id": "0a828c0d-b714-4e35-b980-2c9d185b7a6b"
                }
              ]
            }
          ],
          "createdAt": "2026-10-05T07:01:01.280Z",
          "updatedAt": "2026-10-05T07:01:01.280Z"
        },
        "after": {
          "id": "58f03fa5-92db-40b1-a079-f5bee207168f",
          "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
          "title": "T3 Validation Trip",
          "days": [
            {
              "id": "177d8f48-dca4-45bd-9e95-c713f53180b1",
              "title": "1일차",
              "color": "#2563eb",
              "places": [
                {
                  "id": "1ce589b3-eb83-461d-b672-0d3657fddc76",
                  "placeId": "fixture-place-shibuya",
                  "name": "시부야 스카이",
                  "location": {
                    "lat": 35.6595,
                    "lng": 139.7005
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 1
                },
                {
                  "id": "57802cde-12b7-4eee-8a77-49c9082784f0",
                  "placeId": "fixture-place-ueno",
                  "name": "우에노 공원",
                  "location": {
                    "lat": 35.7148,
                    "lng": 139.7732
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 2
                }
              ],
              "polylines": [
                {
                  "id": "fa47903d-0fbd-426a-992b-04b92e6ea531",
                  "fromPlaceId": "1ce589b3-eb83-461d-b672-0d3657fddc76",
                  "toPlaceId": "57802cde-12b7-4eee-8a77-49c9082784f0",
                  "mode": "straight",
                  "order": 1
                }
              ],
              "layerItems": [
                {
                  "type": "place",
                  "id": "1ce589b3-eb83-461d-b672-0d3657fddc76"
                },
                {
                  "type": "polyline",
                  "id": "fa47903d-0fbd-426a-992b-04b92e6ea531"
                },
                {
                  "type": "place",
                  "id": "57802cde-12b7-4eee-8a77-49c9082784f0"
                }
              ]
            },
            {
              "id": "f672e76d-9428-4be3-836d-2c08443ebd9f",
              "title": "2일차",
              "color": "#2563eb",
              "places": [
                {
                  "id": "0a828c0d-b714-4e35-b980-2c9d185b7a6b",
                  "placeId": "fixture-place-tower",
                  "name": "도쿄 타워",
                  "location": {
                    "lat": 35.6586,
                    "lng": 139.7454
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 1
                }
              ],
              "polylines": [],
              "layerItems": [
                {
                  "type": "place",
                  "id": "0a828c0d-b714-4e35-b980-2c9d185b7a6b"
                }
              ]
            }
          ],
          "createdAt": "2026-10-05T07:01:01.280Z",
          "updatedAt": "2026-10-05T07:01:01.280Z"
        }
      },
      "execution": "PASS",
      "save": "PASS",
      "reload": "PASS",
      "after": {
        "id": "58f03fa5-92db-40b1-a079-f5bee207168f",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "177d8f48-dca4-45bd-9e95-c713f53180b1",
            "title": "1일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "1ce589b3-eb83-461d-b672-0d3657fddc76",
                "placeId": "fixture-place-shibuya",
                "name": "시부야 스카이",
                "location": {
                  "lat": 35.6595,
                  "lng": 139.7005
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              },
              {
                "id": "57802cde-12b7-4eee-8a77-49c9082784f0",
                "placeId": "fixture-place-ueno",
                "name": "우에노 공원",
                "location": {
                  "lat": 35.7148,
                  "lng": 139.7732
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 2
              }
            ],
            "polylines": [
              {
                "id": "fa47903d-0fbd-426a-992b-04b92e6ea531",
                "fromPlaceId": "1ce589b3-eb83-461d-b672-0d3657fddc76",
                "toPlaceId": "57802cde-12b7-4eee-8a77-49c9082784f0",
                "mode": "straight",
                "order": 1
              }
            ],
            "layerItems": [
              {
                "type": "place",
                "id": "1ce589b3-eb83-461d-b672-0d3657fddc76"
              },
              {
                "type": "polyline",
                "id": "fa47903d-0fbd-426a-992b-04b92e6ea531"
              },
              {
                "type": "place",
                "id": "57802cde-12b7-4eee-8a77-49c9082784f0"
              }
            ]
          },
          {
            "id": "f672e76d-9428-4be3-836d-2c08443ebd9f",
            "title": "2일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "0a828c0d-b714-4e35-b980-2c9d185b7a6b",
                "placeId": "fixture-place-tower",
                "name": "도쿄 타워",
                "location": {
                  "lat": 35.6586,
                  "lng": 139.7454
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              }
            ],
            "polylines": [],
            "layerItems": [
              {
                "type": "place",
                "id": "0a828c0d-b714-4e35-b980-2c9d185b7a6b"
              }
            ]
          }
        ],
        "createdAt": "2026-10-05T07:01:01.280Z",
        "updatedAt": "2026-10-05T07:01:08.895Z"
      },
      "intentMatch": "PASS",
      "errorsFixes": [],
      "latency": {
        "modelRequestMs": 7578.300000071526,
        "prepareMs": 1.399999976158142,
        "executeMs": 0.20000004768371582,
        "saveMs": 13.299999952316284,
        "reloadMs": 2.399999976158142,
        "totalMs": 7631.899999976158
      },
      "status": "PASS"
    },
    {
      "scenarioId": "T3-S09",
      "request": "1일차의 시부야 메모를 야경으로 설정해줘.",
      "before": {
        "id": "2aac9c11-a962-4a67-8081-5b34141614a8",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "8958acc4-9e8e-481b-87c0-11cf1c6bb10f",
            "title": "1일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "c85ebe65-72d0-4ab7-9ac3-cb3239983109",
                "placeId": "fixture-place-shibuya",
                "name": "시부야",
                "location": {
                  "lat": 35.6595,
                  "lng": 139.7005
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              },
              {
                "id": "71eebc97-ea48-45b9-9022-f93f2cb31474",
                "placeId": "fixture-place-ueno",
                "name": "우에노 공원",
                "location": {
                  "lat": 35.7148,
                  "lng": 139.7732
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 2
              }
            ],
            "polylines": [
              {
                "id": "2b5fc3dc-94a5-4a56-9093-66788fc0cda4",
                "fromPlaceId": "c85ebe65-72d0-4ab7-9ac3-cb3239983109",
                "toPlaceId": "71eebc97-ea48-45b9-9022-f93f2cb31474",
                "mode": "straight",
                "order": 1
              }
            ],
            "layerItems": [
              {
                "type": "place",
                "id": "c85ebe65-72d0-4ab7-9ac3-cb3239983109"
              },
              {
                "type": "polyline",
                "id": "2b5fc3dc-94a5-4a56-9093-66788fc0cda4"
              },
              {
                "type": "place",
                "id": "71eebc97-ea48-45b9-9022-f93f2cb31474"
              }
            ]
          },
          {
            "id": "b9f2eb4c-9e44-4f3b-a690-934fbeb0cca1",
            "title": "2일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "635bfc55-f8f7-4d00-9121-64a705582848",
                "placeId": "fixture-place-tower",
                "name": "도쿄 타워",
                "location": {
                  "lat": 35.6586,
                  "lng": 139.7454
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              }
            ],
            "polylines": [],
            "layerItems": [
              {
                "type": "place",
                "id": "635bfc55-f8f7-4d00-9121-64a705582848"
              }
            ]
          }
        ],
        "createdAt": "2026-10-05T07:01:08.909Z",
        "updatedAt": "2026-10-05T07:01:08.909Z"
      },
      "provider": "openwebui",
      "model": "qwen3.5:2b",
      "rawOutput": "{\"version\":1,\"base\":{\"tripId\":\"2aac9c11-a962-4a67-8081-5b34141614a8\",\"fingerprint\":\"sha256:9110bb02e6278f01a3db381f5d2159dbdccd7bb367c7e844a9ffd00f954ca4c6\"},\"operations\":[{\"stepId\":\"s1\",\"op\":\"set_memo\",\"place\":{\"kind\":\"id\",\"id\":\"c85ebe65-72d0-4ab7-9ac3-cb3239983109\"},\"memo\":\"야경\"}]}",
      "commandSequence": [
        {
          "stepId": "s1",
          "op": "set_memo",
          "place": {
            "kind": "id",
            "id": "c85ebe65-72d0-4ab7-9ac3-cb3239983109"
          },
          "memo": "야경"
        }
      ],
      "validation": "PASS",
      "preview": {
        "operationCount": 1,
        "commandCount": 2,
        "diff": [
          {
            "op": "set_memo",
            "placeId": "c85ebe65-72d0-4ab7-9ac3-cb3239983109",
            "after": "야경"
          }
        ],
        "risk": {
          "characteristics": ["metadata_edit"]
        },
        "before": {
          "id": "2aac9c11-a962-4a67-8081-5b34141614a8",
          "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
          "title": "T3 Validation Trip",
          "days": [
            {
              "id": "8958acc4-9e8e-481b-87c0-11cf1c6bb10f",
              "title": "1일차",
              "color": "#2563eb",
              "places": [
                {
                  "id": "c85ebe65-72d0-4ab7-9ac3-cb3239983109",
                  "placeId": "fixture-place-shibuya",
                  "name": "시부야",
                  "location": {
                    "lat": 35.6595,
                    "lng": 139.7005
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 1
                },
                {
                  "id": "71eebc97-ea48-45b9-9022-f93f2cb31474",
                  "placeId": "fixture-place-ueno",
                  "name": "우에노 공원",
                  "location": {
                    "lat": 35.7148,
                    "lng": 139.7732
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 2
                }
              ],
              "polylines": [
                {
                  "id": "2b5fc3dc-94a5-4a56-9093-66788fc0cda4",
                  "fromPlaceId": "c85ebe65-72d0-4ab7-9ac3-cb3239983109",
                  "toPlaceId": "71eebc97-ea48-45b9-9022-f93f2cb31474",
                  "mode": "straight",
                  "order": 1
                }
              ],
              "layerItems": [
                {
                  "type": "place",
                  "id": "c85ebe65-72d0-4ab7-9ac3-cb3239983109"
                },
                {
                  "type": "polyline",
                  "id": "2b5fc3dc-94a5-4a56-9093-66788fc0cda4"
                },
                {
                  "type": "place",
                  "id": "71eebc97-ea48-45b9-9022-f93f2cb31474"
                }
              ]
            },
            {
              "id": "b9f2eb4c-9e44-4f3b-a690-934fbeb0cca1",
              "title": "2일차",
              "color": "#2563eb",
              "places": [
                {
                  "id": "635bfc55-f8f7-4d00-9121-64a705582848",
                  "placeId": "fixture-place-tower",
                  "name": "도쿄 타워",
                  "location": {
                    "lat": 35.6586,
                    "lng": 139.7454
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 1
                }
              ],
              "polylines": [],
              "layerItems": [
                {
                  "type": "place",
                  "id": "635bfc55-f8f7-4d00-9121-64a705582848"
                }
              ]
            }
          ],
          "createdAt": "2026-10-05T07:01:08.909Z",
          "updatedAt": "2026-10-05T07:01:08.909Z"
        },
        "after": {
          "id": "2aac9c11-a962-4a67-8081-5b34141614a8",
          "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
          "title": "T3 Validation Trip",
          "days": [
            {
              "id": "8958acc4-9e8e-481b-87c0-11cf1c6bb10f",
              "title": "1일차",
              "color": "#2563eb",
              "places": [
                {
                  "id": "c85ebe65-72d0-4ab7-9ac3-cb3239983109",
                  "placeId": "fixture-place-shibuya",
                  "name": "시부야",
                  "location": {
                    "lat": 35.6595,
                    "lng": 139.7005
                  },
                  "memo": "야경",
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 1
                },
                {
                  "id": "71eebc97-ea48-45b9-9022-f93f2cb31474",
                  "placeId": "fixture-place-ueno",
                  "name": "우에노 공원",
                  "location": {
                    "lat": 35.7148,
                    "lng": 139.7732
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 2
                }
              ],
              "polylines": [
                {
                  "id": "2b5fc3dc-94a5-4a56-9093-66788fc0cda4",
                  "fromPlaceId": "c85ebe65-72d0-4ab7-9ac3-cb3239983109",
                  "toPlaceId": "71eebc97-ea48-45b9-9022-f93f2cb31474",
                  "mode": "straight",
                  "order": 1
                }
              ],
              "layerItems": [
                {
                  "type": "place",
                  "id": "c85ebe65-72d0-4ab7-9ac3-cb3239983109"
                },
                {
                  "type": "polyline",
                  "id": "2b5fc3dc-94a5-4a56-9093-66788fc0cda4"
                },
                {
                  "type": "place",
                  "id": "71eebc97-ea48-45b9-9022-f93f2cb31474"
                }
              ]
            },
            {
              "id": "b9f2eb4c-9e44-4f3b-a690-934fbeb0cca1",
              "title": "2일차",
              "color": "#2563eb",
              "places": [
                {
                  "id": "635bfc55-f8f7-4d00-9121-64a705582848",
                  "placeId": "fixture-place-tower",
                  "name": "도쿄 타워",
                  "location": {
                    "lat": 35.6586,
                    "lng": 139.7454
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 1
                }
              ],
              "polylines": [],
              "layerItems": [
                {
                  "type": "place",
                  "id": "635bfc55-f8f7-4d00-9121-64a705582848"
                }
              ]
            }
          ],
          "createdAt": "2026-10-05T07:01:08.909Z",
          "updatedAt": "2026-10-05T07:01:08.909Z"
        }
      },
      "execution": "PASS",
      "save": "PASS",
      "reload": "PASS",
      "after": {
        "id": "2aac9c11-a962-4a67-8081-5b34141614a8",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "8958acc4-9e8e-481b-87c0-11cf1c6bb10f",
            "title": "1일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "c85ebe65-72d0-4ab7-9ac3-cb3239983109",
                "placeId": "fixture-place-shibuya",
                "name": "시부야",
                "location": {
                  "lat": 35.6595,
                  "lng": 139.7005
                },
                "memo": "야경",
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              },
              {
                "id": "71eebc97-ea48-45b9-9022-f93f2cb31474",
                "placeId": "fixture-place-ueno",
                "name": "우에노 공원",
                "location": {
                  "lat": 35.7148,
                  "lng": 139.7732
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 2
              }
            ],
            "polylines": [
              {
                "id": "2b5fc3dc-94a5-4a56-9093-66788fc0cda4",
                "fromPlaceId": "c85ebe65-72d0-4ab7-9ac3-cb3239983109",
                "toPlaceId": "71eebc97-ea48-45b9-9022-f93f2cb31474",
                "mode": "straight",
                "order": 1
              }
            ],
            "layerItems": [
              {
                "type": "place",
                "id": "c85ebe65-72d0-4ab7-9ac3-cb3239983109"
              },
              {
                "type": "polyline",
                "id": "2b5fc3dc-94a5-4a56-9093-66788fc0cda4"
              },
              {
                "type": "place",
                "id": "71eebc97-ea48-45b9-9022-f93f2cb31474"
              }
            ]
          },
          {
            "id": "b9f2eb4c-9e44-4f3b-a690-934fbeb0cca1",
            "title": "2일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "635bfc55-f8f7-4d00-9121-64a705582848",
                "placeId": "fixture-place-tower",
                "name": "도쿄 타워",
                "location": {
                  "lat": 35.6586,
                  "lng": 139.7454
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              }
            ],
            "polylines": [],
            "layerItems": [
              {
                "type": "place",
                "id": "635bfc55-f8f7-4d00-9121-64a705582848"
              }
            ]
          }
        ],
        "createdAt": "2026-10-05T07:01:08.909Z",
        "updatedAt": "2026-10-05T07:01:21.186Z"
      },
      "intentMatch": "PASS",
      "errorsFixes": [],
      "latency": {
        "modelRequestMs": 12242.600000023842,
        "prepareMs": 1,
        "executeMs": 1.6999999284744263,
        "saveMs": 11.200000047683716,
        "reloadMs": 3.6999999284744263,
        "totalMs": 12296.399999976158
      },
      "status": "PASS"
    },
    {
      "scenarioId": "T3-S10",
      "request": "1일차의 시부야 방문 시작 시간을 오후 2시로 바꿔줘.",
      "before": {
        "id": "b0da13c3-9569-4bd5-8c58-c8da8fe1a646",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "4a3ae9cb-2d0a-4f8b-bd84-af1d7b271f8b",
            "title": "1일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "13610bd3-3f34-4e97-8963-40a6dd23495a",
                "placeId": "fixture-place-shibuya",
                "name": "시부야",
                "location": {
                  "lat": 35.6595,
                  "lng": 139.7005
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              },
              {
                "id": "03abbeff-dc34-4235-9282-cf3a2ec5534d",
                "placeId": "fixture-place-ueno",
                "name": "우에노 공원",
                "location": {
                  "lat": 35.7148,
                  "lng": 139.7732
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 2
              }
            ],
            "polylines": [
              {
                "id": "c02132bd-008d-4104-9b06-fd3c67e30e80",
                "fromPlaceId": "13610bd3-3f34-4e97-8963-40a6dd23495a",
                "toPlaceId": "03abbeff-dc34-4235-9282-cf3a2ec5534d",
                "mode": "straight",
                "order": 1
              }
            ],
            "layerItems": [
              {
                "type": "place",
                "id": "13610bd3-3f34-4e97-8963-40a6dd23495a"
              },
              {
                "type": "polyline",
                "id": "c02132bd-008d-4104-9b06-fd3c67e30e80"
              },
              {
                "type": "place",
                "id": "03abbeff-dc34-4235-9282-cf3a2ec5534d"
              }
            ]
          },
          {
            "id": "d4f2d3ef-9c20-4889-b626-8293aa200f81",
            "title": "2일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "33928031-f66a-4307-8592-5d2ea0cbd074",
                "placeId": "fixture-place-tower",
                "name": "도쿄 타워",
                "location": {
                  "lat": 35.6586,
                  "lng": 139.7454
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              }
            ],
            "polylines": [],
            "layerItems": [
              {
                "type": "place",
                "id": "33928031-f66a-4307-8592-5d2ea0cbd074"
              }
            ]
          }
        ],
        "createdAt": "2026-10-05T07:01:21.208Z",
        "updatedAt": "2026-10-05T07:01:21.208Z"
      },
      "provider": "openwebui",
      "model": "qwen3.5:2b",
      "rawOutput": "{\"version\":1,\"base\":{\"tripId\":\"b0da13c3-9569-4bd5-8c58-c8da8fe1a646\",\"fingerprint\":\"sha256:e993c3d0a9a69003748e062aa6e449847664a99534ae432f3241a07eeba8b417\"},\"operations\":[{\"stepId\":\"s1\",\"op\":\"set_visit_time\",\"place\":{\"kind\":\"id\",\"id\":\"13610bd3-3f34-4e97-8963-40a6dd23495a\"},\"time\":\"14:00\"}]}",
      "commandSequence": [
        {
          "stepId": "s1",
          "op": "set_visit_time",
          "place": {
            "kind": "id",
            "id": "13610bd3-3f34-4e97-8963-40a6dd23495a"
          },
          "time": "14:00"
        }
      ],
      "validation": "PASS",
      "preview": {
        "operationCount": 1,
        "commandCount": 2,
        "diff": [
          {
            "op": "set_visit_time",
            "placeId": "13610bd3-3f34-4e97-8963-40a6dd23495a",
            "before": "10:00",
            "after": "14:00"
          }
        ],
        "risk": {
          "characteristics": ["metadata_edit"]
        },
        "before": {
          "id": "b0da13c3-9569-4bd5-8c58-c8da8fe1a646",
          "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
          "title": "T3 Validation Trip",
          "days": [
            {
              "id": "4a3ae9cb-2d0a-4f8b-bd84-af1d7b271f8b",
              "title": "1일차",
              "color": "#2563eb",
              "places": [
                {
                  "id": "13610bd3-3f34-4e97-8963-40a6dd23495a",
                  "placeId": "fixture-place-shibuya",
                  "name": "시부야",
                  "location": {
                    "lat": 35.6595,
                    "lng": 139.7005
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 1
                },
                {
                  "id": "03abbeff-dc34-4235-9282-cf3a2ec5534d",
                  "placeId": "fixture-place-ueno",
                  "name": "우에노 공원",
                  "location": {
                    "lat": 35.7148,
                    "lng": 139.7732
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 2
                }
              ],
              "polylines": [
                {
                  "id": "c02132bd-008d-4104-9b06-fd3c67e30e80",
                  "fromPlaceId": "13610bd3-3f34-4e97-8963-40a6dd23495a",
                  "toPlaceId": "03abbeff-dc34-4235-9282-cf3a2ec5534d",
                  "mode": "straight",
                  "order": 1
                }
              ],
              "layerItems": [
                {
                  "type": "place",
                  "id": "13610bd3-3f34-4e97-8963-40a6dd23495a"
                },
                {
                  "type": "polyline",
                  "id": "c02132bd-008d-4104-9b06-fd3c67e30e80"
                },
                {
                  "type": "place",
                  "id": "03abbeff-dc34-4235-9282-cf3a2ec5534d"
                }
              ]
            },
            {
              "id": "d4f2d3ef-9c20-4889-b626-8293aa200f81",
              "title": "2일차",
              "color": "#2563eb",
              "places": [
                {
                  "id": "33928031-f66a-4307-8592-5d2ea0cbd074",
                  "placeId": "fixture-place-tower",
                  "name": "도쿄 타워",
                  "location": {
                    "lat": 35.6586,
                    "lng": 139.7454
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 1
                }
              ],
              "polylines": [],
              "layerItems": [
                {
                  "type": "place",
                  "id": "33928031-f66a-4307-8592-5d2ea0cbd074"
                }
              ]
            }
          ],
          "createdAt": "2026-10-05T07:01:21.208Z",
          "updatedAt": "2026-10-05T07:01:21.208Z"
        },
        "after": {
          "id": "b0da13c3-9569-4bd5-8c58-c8da8fe1a646",
          "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
          "title": "T3 Validation Trip",
          "days": [
            {
              "id": "4a3ae9cb-2d0a-4f8b-bd84-af1d7b271f8b",
              "title": "1일차",
              "color": "#2563eb",
              "places": [
                {
                  "id": "13610bd3-3f34-4e97-8963-40a6dd23495a",
                  "placeId": "fixture-place-shibuya",
                  "name": "시부야",
                  "location": {
                    "lat": 35.6595,
                    "lng": 139.7005
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "14:00",
                  "order": 1
                },
                {
                  "id": "03abbeff-dc34-4235-9282-cf3a2ec5534d",
                  "placeId": "fixture-place-ueno",
                  "name": "우에노 공원",
                  "location": {
                    "lat": 35.7148,
                    "lng": 139.7732
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 2
                }
              ],
              "polylines": [
                {
                  "id": "c02132bd-008d-4104-9b06-fd3c67e30e80",
                  "fromPlaceId": "13610bd3-3f34-4e97-8963-40a6dd23495a",
                  "toPlaceId": "03abbeff-dc34-4235-9282-cf3a2ec5534d",
                  "mode": "straight",
                  "order": 1
                }
              ],
              "layerItems": [
                {
                  "type": "place",
                  "id": "13610bd3-3f34-4e97-8963-40a6dd23495a"
                },
                {
                  "type": "polyline",
                  "id": "c02132bd-008d-4104-9b06-fd3c67e30e80"
                },
                {
                  "type": "place",
                  "id": "03abbeff-dc34-4235-9282-cf3a2ec5534d"
                }
              ]
            },
            {
              "id": "d4f2d3ef-9c20-4889-b626-8293aa200f81",
              "title": "2일차",
              "color": "#2563eb",
              "places": [
                {
                  "id": "33928031-f66a-4307-8592-5d2ea0cbd074",
                  "placeId": "fixture-place-tower",
                  "name": "도쿄 타워",
                  "location": {
                    "lat": 35.6586,
                    "lng": 139.7454
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 1
                }
              ],
              "polylines": [],
              "layerItems": [
                {
                  "type": "place",
                  "id": "33928031-f66a-4307-8592-5d2ea0cbd074"
                }
              ]
            }
          ],
          "createdAt": "2026-10-05T07:01:21.208Z",
          "updatedAt": "2026-10-05T07:01:21.208Z"
        }
      },
      "execution": "PASS",
      "save": "PASS",
      "reload": "PASS",
      "after": {
        "id": "b0da13c3-9569-4bd5-8c58-c8da8fe1a646",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "4a3ae9cb-2d0a-4f8b-bd84-af1d7b271f8b",
            "title": "1일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "13610bd3-3f34-4e97-8963-40a6dd23495a",
                "placeId": "fixture-place-shibuya",
                "name": "시부야",
                "location": {
                  "lat": 35.6595,
                  "lng": 139.7005
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "14:00",
                "order": 1
              },
              {
                "id": "03abbeff-dc34-4235-9282-cf3a2ec5534d",
                "placeId": "fixture-place-ueno",
                "name": "우에노 공원",
                "location": {
                  "lat": 35.7148,
                  "lng": 139.7732
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 2
              }
            ],
            "polylines": [
              {
                "id": "c02132bd-008d-4104-9b06-fd3c67e30e80",
                "fromPlaceId": "13610bd3-3f34-4e97-8963-40a6dd23495a",
                "toPlaceId": "03abbeff-dc34-4235-9282-cf3a2ec5534d",
                "mode": "straight",
                "order": 1
              }
            ],
            "layerItems": [
              {
                "type": "place",
                "id": "13610bd3-3f34-4e97-8963-40a6dd23495a"
              },
              {
                "type": "polyline",
                "id": "c02132bd-008d-4104-9b06-fd3c67e30e80"
              },
              {
                "type": "place",
                "id": "03abbeff-dc34-4235-9282-cf3a2ec5534d"
              }
            ]
          },
          {
            "id": "d4f2d3ef-9c20-4889-b626-8293aa200f81",
            "title": "2일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "33928031-f66a-4307-8592-5d2ea0cbd074",
                "placeId": "fixture-place-tower",
                "name": "도쿄 타워",
                "location": {
                  "lat": 35.6586,
                  "lng": 139.7454
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              }
            ],
            "polylines": [],
            "layerItems": [
              {
                "type": "place",
                "id": "33928031-f66a-4307-8592-5d2ea0cbd074"
              }
            ]
          }
        ],
        "createdAt": "2026-10-05T07:01:21.208Z",
        "updatedAt": "2026-10-05T07:01:29.004Z"
      },
      "intentMatch": "PASS",
      "errorsFixes": [],
      "latency": {
        "modelRequestMs": 7772.200000047684,
        "prepareMs": 0.5,
        "executeMs": 0.5,
        "saveMs": 9,
        "reloadMs": 2.200000047683716,
        "totalMs": 7809.800000071526
      },
      "status": "PASS"
    },
    {
      "scenarioId": "T3-S11",
      "request": "1일차의 시부야 방문 시간을 90분으로 바꿔줘.",
      "before": {
        "id": "29d9fc33-3a42-421f-93d4-69741dcf286a",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "e53ed4b0-ea64-4569-b916-169ee25fbb70",
            "title": "1일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "14dae65e-07fd-4f76-abea-28e1f8c99dc2",
                "placeId": "fixture-place-shibuya",
                "name": "시부야",
                "location": {
                  "lat": 35.6595,
                  "lng": 139.7005
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              },
              {
                "id": "f0ee52cf-e92d-4da0-abb5-d04374c011b4",
                "placeId": "fixture-place-ueno",
                "name": "우에노 공원",
                "location": {
                  "lat": 35.7148,
                  "lng": 139.7732
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 2
              }
            ],
            "polylines": [
              {
                "id": "8c485afe-54ed-4576-8241-f3aa438265e3",
                "fromPlaceId": "14dae65e-07fd-4f76-abea-28e1f8c99dc2",
                "toPlaceId": "f0ee52cf-e92d-4da0-abb5-d04374c011b4",
                "mode": "straight",
                "order": 1
              }
            ],
            "layerItems": [
              {
                "type": "place",
                "id": "14dae65e-07fd-4f76-abea-28e1f8c99dc2"
              },
              {
                "type": "polyline",
                "id": "8c485afe-54ed-4576-8241-f3aa438265e3"
              },
              {
                "type": "place",
                "id": "f0ee52cf-e92d-4da0-abb5-d04374c011b4"
              }
            ]
          },
          {
            "id": "90ad8b09-e1e2-4645-bc1f-176894bf2f05",
            "title": "2일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "b09fe6af-7091-4bc3-97b0-8891c28ce14d",
                "placeId": "fixture-place-tower",
                "name": "도쿄 타워",
                "location": {
                  "lat": 35.6586,
                  "lng": 139.7454
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              }
            ],
            "polylines": [],
            "layerItems": [
              {
                "type": "place",
                "id": "b09fe6af-7091-4bc3-97b0-8891c28ce14d"
              }
            ]
          }
        ],
        "createdAt": "2026-10-05T07:01:29.018Z",
        "updatedAt": "2026-10-05T07:01:29.018Z"
      },
      "provider": "openwebui",
      "model": "qwen3.5:2b",
      "rawOutput": "{\"version\":1,\"base\":{\"tripId\":\"29d9fc33-3a42-421f-93d4-69741dcf286a\",\"fingerprint\":\"sha256:afc163e35979e117581d6ead92221c47c70336b5410bc0be118a077bc6e28a2c\"},\"operations\":[{\"stepId\":\"s1\",\"op\":\"set_visit_time\",\"place\":{\"kind\":\"id\",\"id\":\"14dae65e-07fd-4f76-abea-28e1f8c99dc2\"},\"time\":\"90\"}]}",
      "commandSequence": [],
      "validation": "NOT_RUN",
      "preview": null,
      "execution": "NOT_RUN",
      "save": "NOT_RUN",
      "reload": "NOT_RUN",
      "after": null,
      "intentMatch": "NOT_RUN",
      "errorsFixes": [
        "PARSER_SCHEMA_FAILURE: schema_invalid: MODEL_RESPONSE_FAILED_TRIP_COMMAND_PLAN_SCHEMA"
      ],
      "latency": {
        "modelRequestMs": 7592.800000071526,
        "prepareMs": null,
        "executeMs": null,
        "saveMs": null,
        "reloadMs": null,
        "totalMs": 7611.099999904633
      },
      "status": "FAIL"
    },
    {
      "scenarioId": "T3-S12",
      "request": "1일차의 시부야 선호 체류 시간을 120분으로 바꿔줘.",
      "before": {
        "id": "a1e851ab-713f-43b9-8f3b-0a870ac56acd",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "ac030f40-917c-4497-aa79-cdb18bd7e2c7",
            "title": "1일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "2ad74a1e-dc60-4ba3-9d73-0807f0f96ea7",
                "placeId": "fixture-place-shibuya",
                "name": "시부야",
                "location": {
                  "lat": 35.6595,
                  "lng": 139.7005
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              },
              {
                "id": "ea14f408-1d46-4780-ab46-b2fff8cc33df",
                "placeId": "fixture-place-ueno",
                "name": "우에노 공원",
                "location": {
                  "lat": 35.7148,
                  "lng": 139.7732
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 2
              }
            ],
            "polylines": [
              {
                "id": "6e7523fe-33bf-40dc-82b8-f71e6a740e09",
                "fromPlaceId": "2ad74a1e-dc60-4ba3-9d73-0807f0f96ea7",
                "toPlaceId": "ea14f408-1d46-4780-ab46-b2fff8cc33df",
                "mode": "straight",
                "order": 1
              }
            ],
            "layerItems": [
              {
                "type": "place",
                "id": "2ad74a1e-dc60-4ba3-9d73-0807f0f96ea7"
              },
              {
                "type": "polyline",
                "id": "6e7523fe-33bf-40dc-82b8-f71e6a740e09"
              },
              {
                "type": "place",
                "id": "ea14f408-1d46-4780-ab46-b2fff8cc33df"
              }
            ]
          },
          {
            "id": "47f0cb18-f8a5-4ce9-a576-d95f4ec7317e",
            "title": "2일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "2acc00eb-9aab-4616-85ae-d00ae2f0fdc6",
                "placeId": "fixture-place-tower",
                "name": "도쿄 타워",
                "location": {
                  "lat": 35.6586,
                  "lng": 139.7454
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              }
            ],
            "polylines": [],
            "layerItems": [
              {
                "type": "place",
                "id": "2acc00eb-9aab-4616-85ae-d00ae2f0fdc6"
              }
            ]
          }
        ],
        "createdAt": "2026-10-05T07:01:36.633Z",
        "updatedAt": "2026-10-05T07:01:36.633Z"
      },
      "provider": "openwebui",
      "model": "qwen3.5:2b",
      "rawOutput": "{\"version\":1,\"base\":{\"tripId\":\"a1e851ab-713f-43b9-8f3b-0a870ac56acd\",\"fingerprint\":\"sha256:4f43e39d8e7da5d9b6e0f14d117e9857496b39d4ad9c7d5b8f2c11581957f0b9\"},\"operations\":[{\"stepId\":\"s1\",\"op\":\"set_preferred_duration\",\"place\":{\"kind\":\"id\",\"id\":\"2ad74a1e-dc60-4ba3-9d73-0807f0f96ea7\"},\"minutes\":120}]}",
      "commandSequence": [
        {
          "stepId": "s1",
          "op": "set_preferred_duration",
          "place": {
            "kind": "id",
            "id": "2ad74a1e-dc60-4ba3-9d73-0807f0f96ea7"
          },
          "minutes": 120
        }
      ],
      "validation": "PASS",
      "preview": {
        "operationCount": 1,
        "commandCount": 2,
        "diff": [
          {
            "op": "set_visit_duration",
            "placeId": "2ad74a1e-dc60-4ba3-9d73-0807f0f96ea7",
            "before": 60,
            "after": 120
          },
          {
            "op": "set_preferred_duration",
            "placeId": "2ad74a1e-dc60-4ba3-9d73-0807f0f96ea7",
            "before": 60,
            "after": 120
          }
        ],
        "risk": {
          "characteristics": ["metadata_edit"]
        },
        "before": {
          "id": "a1e851ab-713f-43b9-8f3b-0a870ac56acd",
          "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
          "title": "T3 Validation Trip",
          "days": [
            {
              "id": "ac030f40-917c-4497-aa79-cdb18bd7e2c7",
              "title": "1일차",
              "color": "#2563eb",
              "places": [
                {
                  "id": "2ad74a1e-dc60-4ba3-9d73-0807f0f96ea7",
                  "placeId": "fixture-place-shibuya",
                  "name": "시부야",
                  "location": {
                    "lat": 35.6595,
                    "lng": 139.7005
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 1
                },
                {
                  "id": "ea14f408-1d46-4780-ab46-b2fff8cc33df",
                  "placeId": "fixture-place-ueno",
                  "name": "우에노 공원",
                  "location": {
                    "lat": 35.7148,
                    "lng": 139.7732
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 2
                }
              ],
              "polylines": [
                {
                  "id": "6e7523fe-33bf-40dc-82b8-f71e6a740e09",
                  "fromPlaceId": "2ad74a1e-dc60-4ba3-9d73-0807f0f96ea7",
                  "toPlaceId": "ea14f408-1d46-4780-ab46-b2fff8cc33df",
                  "mode": "straight",
                  "order": 1
                }
              ],
              "layerItems": [
                {
                  "type": "place",
                  "id": "2ad74a1e-dc60-4ba3-9d73-0807f0f96ea7"
                },
                {
                  "type": "polyline",
                  "id": "6e7523fe-33bf-40dc-82b8-f71e6a740e09"
                },
                {
                  "type": "place",
                  "id": "ea14f408-1d46-4780-ab46-b2fff8cc33df"
                }
              ]
            },
            {
              "id": "47f0cb18-f8a5-4ce9-a576-d95f4ec7317e",
              "title": "2일차",
              "color": "#2563eb",
              "places": [
                {
                  "id": "2acc00eb-9aab-4616-85ae-d00ae2f0fdc6",
                  "placeId": "fixture-place-tower",
                  "name": "도쿄 타워",
                  "location": {
                    "lat": 35.6586,
                    "lng": 139.7454
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 1
                }
              ],
              "polylines": [],
              "layerItems": [
                {
                  "type": "place",
                  "id": "2acc00eb-9aab-4616-85ae-d00ae2f0fdc6"
                }
              ]
            }
          ],
          "createdAt": "2026-10-05T07:01:36.633Z",
          "updatedAt": "2026-10-05T07:01:36.633Z"
        },
        "after": {
          "id": "a1e851ab-713f-43b9-8f3b-0a870ac56acd",
          "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
          "title": "T3 Validation Trip",
          "days": [
            {
              "id": "ac030f40-917c-4497-aa79-cdb18bd7e2c7",
              "title": "1일차",
              "color": "#2563eb",
              "places": [
                {
                  "id": "2ad74a1e-dc60-4ba3-9d73-0807f0f96ea7",
                  "placeId": "fixture-place-shibuya",
                  "name": "시부야",
                  "location": {
                    "lat": 35.6595,
                    "lng": 139.7005
                  },
                  "visitDurationMinutes": 120,
                  "preferredDurationMinutes": 120,
                  "time": "10:00",
                  "order": 1
                },
                {
                  "id": "ea14f408-1d46-4780-ab46-b2fff8cc33df",
                  "placeId": "fixture-place-ueno",
                  "name": "우에노 공원",
                  "location": {
                    "lat": 35.7148,
                    "lng": 139.7732
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 2
                }
              ],
              "polylines": [
                {
                  "id": "6e7523fe-33bf-40dc-82b8-f71e6a740e09",
                  "fromPlaceId": "2ad74a1e-dc60-4ba3-9d73-0807f0f96ea7",
                  "toPlaceId": "ea14f408-1d46-4780-ab46-b2fff8cc33df",
                  "mode": "straight",
                  "order": 1
                }
              ],
              "layerItems": [
                {
                  "type": "place",
                  "id": "2ad74a1e-dc60-4ba3-9d73-0807f0f96ea7"
                },
                {
                  "type": "polyline",
                  "id": "6e7523fe-33bf-40dc-82b8-f71e6a740e09"
                },
                {
                  "type": "place",
                  "id": "ea14f408-1d46-4780-ab46-b2fff8cc33df"
                }
              ]
            },
            {
              "id": "47f0cb18-f8a5-4ce9-a576-d95f4ec7317e",
              "title": "2일차",
              "color": "#2563eb",
              "places": [
                {
                  "id": "2acc00eb-9aab-4616-85ae-d00ae2f0fdc6",
                  "placeId": "fixture-place-tower",
                  "name": "도쿄 타워",
                  "location": {
                    "lat": 35.6586,
                    "lng": 139.7454
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 1
                }
              ],
              "polylines": [],
              "layerItems": [
                {
                  "type": "place",
                  "id": "2acc00eb-9aab-4616-85ae-d00ae2f0fdc6"
                }
              ]
            }
          ],
          "createdAt": "2026-10-05T07:01:36.633Z",
          "updatedAt": "2026-10-05T07:01:36.633Z"
        }
      },
      "execution": "PASS",
      "save": "PASS",
      "reload": "PASS",
      "after": {
        "id": "a1e851ab-713f-43b9-8f3b-0a870ac56acd",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "ac030f40-917c-4497-aa79-cdb18bd7e2c7",
            "title": "1일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "2ad74a1e-dc60-4ba3-9d73-0807f0f96ea7",
                "placeId": "fixture-place-shibuya",
                "name": "시부야",
                "location": {
                  "lat": 35.6595,
                  "lng": 139.7005
                },
                "visitDurationMinutes": 120,
                "preferredDurationMinutes": 120,
                "time": "10:00",
                "order": 1
              },
              {
                "id": "ea14f408-1d46-4780-ab46-b2fff8cc33df",
                "placeId": "fixture-place-ueno",
                "name": "우에노 공원",
                "location": {
                  "lat": 35.7148,
                  "lng": 139.7732
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 2
              }
            ],
            "polylines": [
              {
                "id": "6e7523fe-33bf-40dc-82b8-f71e6a740e09",
                "fromPlaceId": "2ad74a1e-dc60-4ba3-9d73-0807f0f96ea7",
                "toPlaceId": "ea14f408-1d46-4780-ab46-b2fff8cc33df",
                "mode": "straight",
                "order": 1
              }
            ],
            "layerItems": [
              {
                "type": "place",
                "id": "2ad74a1e-dc60-4ba3-9d73-0807f0f96ea7"
              },
              {
                "type": "polyline",
                "id": "6e7523fe-33bf-40dc-82b8-f71e6a740e09"
              },
              {
                "type": "place",
                "id": "ea14f408-1d46-4780-ab46-b2fff8cc33df"
              }
            ]
          },
          {
            "id": "47f0cb18-f8a5-4ce9-a576-d95f4ec7317e",
            "title": "2일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "2acc00eb-9aab-4616-85ae-d00ae2f0fdc6",
                "placeId": "fixture-place-tower",
                "name": "도쿄 타워",
                "location": {
                  "lat": 35.6586,
                  "lng": 139.7454
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              }
            ],
            "polylines": [],
            "layerItems": [
              {
                "type": "place",
                "id": "2acc00eb-9aab-4616-85ae-d00ae2f0fdc6"
              }
            ]
          }
        ],
        "createdAt": "2026-10-05T07:01:36.633Z",
        "updatedAt": "2026-10-05T07:01:46.320Z"
      },
      "intentMatch": "PASS",
      "errorsFixes": [],
      "latency": {
        "modelRequestMs": 9660.100000023842,
        "prepareMs": 0.9000000953674316,
        "executeMs": 0.5,
        "saveMs": 9.600000023841858,
        "reloadMs": 1.6999999284744263,
        "totalMs": 9702.099999904633
      },
      "status": "PASS"
    },
    {
      "scenarioId": "T3-S13",
      "request": "1일차의 시부야에서 도쿄 타워로 이어지는 경로를 도보 모드로 바꿔줘.",
      "before": {
        "id": "70af35fd-f48c-4b1a-940b-9db6942feb52",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "bedb0c1a-ca65-4e24-b4b5-775f774f9329",
            "title": "1일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "8a34dfc8-0242-4927-bdc9-ba5cc0aa5ed3",
                "placeId": "fixture-place-shibuya",
                "name": "시부야",
                "location": {
                  "lat": 35.6595,
                  "lng": 139.7005
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              },
              {
                "id": "c525cabd-ca70-4bf0-90fd-199afc3a86bd",
                "placeId": "fixture-place-tower",
                "name": "도쿄 타워",
                "location": {
                  "lat": 35.6586,
                  "lng": 139.7454
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 2
              }
            ],
            "polylines": [
              {
                "id": "ce1fcad8-5f94-4dc6-9d1c-cd2559a048f7",
                "fromPlaceId": "8a34dfc8-0242-4927-bdc9-ba5cc0aa5ed3",
                "toPlaceId": "c525cabd-ca70-4bf0-90fd-199afc3a86bd",
                "mode": "straight",
                "order": 1
              }
            ],
            "layerItems": [
              {
                "type": "place",
                "id": "8a34dfc8-0242-4927-bdc9-ba5cc0aa5ed3"
              },
              {
                "type": "polyline",
                "id": "ce1fcad8-5f94-4dc6-9d1c-cd2559a048f7"
              },
              {
                "type": "place",
                "id": "c525cabd-ca70-4bf0-90fd-199afc3a86bd"
              }
            ]
          }
        ],
        "createdAt": "2026-10-05T07:01:46.333Z",
        "updatedAt": "2026-10-05T07:01:46.333Z"
      },
      "provider": "openwebui",
      "model": "qwen3.5:2b",
      "rawOutput": "{\"version\":1,\"base\":{\"tripId\":\"70af35fd-f48c-4b1a-940b-9db6942feb52\",\"fingerprint\":\"sha256:37aa051a1bbd85baa44e26392dbe18f006f7167aa2c2bafd7d9114c9f468c16f\"},\"operations\":[{\"stepId\":\"s1\",\"op\":\"set_polyline_mode\",\"polyline\":{\"kind\":\"id\",\"id\":\"ce1fcad8-5f94-4dc6-9d1c-cd2559a048f7\"},\"mode\":\"walking\"}]}",
      "commandSequence": [
        {
          "stepId": "s1",
          "op": "set_polyline_mode",
          "polyline": {
            "kind": "id",
            "id": "ce1fcad8-5f94-4dc6-9d1c-cd2559a048f7"
          },
          "mode": "walking"
        }
      ],
      "validation": "PASS",
      "preview": {
        "operationCount": 1,
        "commandCount": 2,
        "diff": [
          {
            "op": "set_polyline_mode",
            "polylineId": "ce1fcad8-5f94-4dc6-9d1c-cd2559a048f7",
            "before": "straight",
            "after": "walking"
          }
        ],
        "risk": {
          "characteristics": ["metadata_edit"]
        },
        "before": {
          "id": "70af35fd-f48c-4b1a-940b-9db6942feb52",
          "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
          "title": "T3 Validation Trip",
          "days": [
            {
              "id": "bedb0c1a-ca65-4e24-b4b5-775f774f9329",
              "title": "1일차",
              "color": "#2563eb",
              "places": [
                {
                  "id": "8a34dfc8-0242-4927-bdc9-ba5cc0aa5ed3",
                  "placeId": "fixture-place-shibuya",
                  "name": "시부야",
                  "location": {
                    "lat": 35.6595,
                    "lng": 139.7005
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 1
                },
                {
                  "id": "c525cabd-ca70-4bf0-90fd-199afc3a86bd",
                  "placeId": "fixture-place-tower",
                  "name": "도쿄 타워",
                  "location": {
                    "lat": 35.6586,
                    "lng": 139.7454
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 2
                }
              ],
              "polylines": [
                {
                  "id": "ce1fcad8-5f94-4dc6-9d1c-cd2559a048f7",
                  "fromPlaceId": "8a34dfc8-0242-4927-bdc9-ba5cc0aa5ed3",
                  "toPlaceId": "c525cabd-ca70-4bf0-90fd-199afc3a86bd",
                  "mode": "straight",
                  "order": 1
                }
              ],
              "layerItems": [
                {
                  "type": "place",
                  "id": "8a34dfc8-0242-4927-bdc9-ba5cc0aa5ed3"
                },
                {
                  "type": "polyline",
                  "id": "ce1fcad8-5f94-4dc6-9d1c-cd2559a048f7"
                },
                {
                  "type": "place",
                  "id": "c525cabd-ca70-4bf0-90fd-199afc3a86bd"
                }
              ]
            }
          ],
          "createdAt": "2026-10-05T07:01:46.333Z",
          "updatedAt": "2026-10-05T07:01:46.333Z"
        },
        "after": {
          "id": "70af35fd-f48c-4b1a-940b-9db6942feb52",
          "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
          "title": "T3 Validation Trip",
          "days": [
            {
              "id": "bedb0c1a-ca65-4e24-b4b5-775f774f9329",
              "title": "1일차",
              "color": "#2563eb",
              "places": [
                {
                  "id": "8a34dfc8-0242-4927-bdc9-ba5cc0aa5ed3",
                  "placeId": "fixture-place-shibuya",
                  "name": "시부야",
                  "location": {
                    "lat": 35.6595,
                    "lng": 139.7005
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 1
                },
                {
                  "id": "c525cabd-ca70-4bf0-90fd-199afc3a86bd",
                  "placeId": "fixture-place-tower",
                  "name": "도쿄 타워",
                  "location": {
                    "lat": 35.6586,
                    "lng": 139.7454
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 2
                }
              ],
              "polylines": [
                {
                  "id": "ce1fcad8-5f94-4dc6-9d1c-cd2559a048f7",
                  "fromPlaceId": "8a34dfc8-0242-4927-bdc9-ba5cc0aa5ed3",
                  "toPlaceId": "c525cabd-ca70-4bf0-90fd-199afc3a86bd",
                  "mode": "walking",
                  "order": 1
                }
              ],
              "layerItems": [
                {
                  "type": "place",
                  "id": "8a34dfc8-0242-4927-bdc9-ba5cc0aa5ed3"
                },
                {
                  "type": "polyline",
                  "id": "ce1fcad8-5f94-4dc6-9d1c-cd2559a048f7"
                },
                {
                  "type": "place",
                  "id": "c525cabd-ca70-4bf0-90fd-199afc3a86bd"
                }
              ]
            }
          ],
          "createdAt": "2026-10-05T07:01:46.333Z",
          "updatedAt": "2026-10-05T07:01:46.333Z"
        }
      },
      "execution": "PASS",
      "save": "PASS",
      "reload": "PASS",
      "after": {
        "id": "70af35fd-f48c-4b1a-940b-9db6942feb52",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "bedb0c1a-ca65-4e24-b4b5-775f774f9329",
            "title": "1일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "8a34dfc8-0242-4927-bdc9-ba5cc0aa5ed3",
                "placeId": "fixture-place-shibuya",
                "name": "시부야",
                "location": {
                  "lat": 35.6595,
                  "lng": 139.7005
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              },
              {
                "id": "c525cabd-ca70-4bf0-90fd-199afc3a86bd",
                "placeId": "fixture-place-tower",
                "name": "도쿄 타워",
                "location": {
                  "lat": 35.6586,
                  "lng": 139.7454
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 2
              }
            ],
            "polylines": [
              {
                "id": "ce1fcad8-5f94-4dc6-9d1c-cd2559a048f7",
                "fromPlaceId": "8a34dfc8-0242-4927-bdc9-ba5cc0aa5ed3",
                "toPlaceId": "c525cabd-ca70-4bf0-90fd-199afc3a86bd",
                "mode": "walking",
                "order": 1
              }
            ],
            "layerItems": [
              {
                "type": "place",
                "id": "8a34dfc8-0242-4927-bdc9-ba5cc0aa5ed3"
              },
              {
                "type": "polyline",
                "id": "ce1fcad8-5f94-4dc6-9d1c-cd2559a048f7"
              },
              {
                "type": "place",
                "id": "c525cabd-ca70-4bf0-90fd-199afc3a86bd"
              }
            ]
          }
        ],
        "createdAt": "2026-10-05T07:01:46.333Z",
        "updatedAt": "2026-10-05T07:01:54.778Z"
      },
      "intentMatch": "PASS",
      "errorsFixes": [],
      "latency": {
        "modelRequestMs": 8409.100000023842,
        "prepareMs": 2.1999999284744263,
        "executeMs": 0.2999999523162842,
        "saveMs": 7.799999952316284,
        "reloadMs": 2.200000047683716,
        "totalMs": 8457.299999952316
      },
      "status": "PASS"
    },
    {
      "scenarioId": "T3-C2",
      "request": "시부야를 1일차에서 2일차 마지막으로 옮기고 메모에 야경이라고 적어줘.",
      "before": {
        "id": "45843aee-8301-4093-afe1-f583e5ce420f",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "2e4f370a-8ff6-4be6-8d4d-ed73ebd90e00",
            "title": "1일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "1492e257-1e7b-4796-ba28-aed35fcaefa9",
                "placeId": "fixture-place-shibuya",
                "name": "시부야",
                "location": {
                  "lat": 35.6595,
                  "lng": 139.7005
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              },
              {
                "id": "21a13268-5dca-4ed8-8696-5191167c62d1",
                "placeId": "fixture-place-ueno",
                "name": "우에노 공원",
                "location": {
                  "lat": 35.7148,
                  "lng": 139.7732
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 2
              }
            ],
            "polylines": [
              {
                "id": "87823812-0132-4d6d-bbc1-02d77ccf39a8",
                "fromPlaceId": "1492e257-1e7b-4796-ba28-aed35fcaefa9",
                "toPlaceId": "21a13268-5dca-4ed8-8696-5191167c62d1",
                "mode": "straight",
                "order": 1
              }
            ],
            "layerItems": [
              {
                "type": "place",
                "id": "1492e257-1e7b-4796-ba28-aed35fcaefa9"
              },
              {
                "type": "polyline",
                "id": "87823812-0132-4d6d-bbc1-02d77ccf39a8"
              },
              {
                "type": "place",
                "id": "21a13268-5dca-4ed8-8696-5191167c62d1"
              }
            ]
          },
          {
            "id": "d9c60b3c-8f87-4edd-9b1c-1de5dab6f7d8",
            "title": "2일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "2fc07044-f875-4567-8c5b-0b617bbf7d29",
                "placeId": "fixture-place-tower",
                "name": "도쿄 타워",
                "location": {
                  "lat": 35.6586,
                  "lng": 139.7454
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              }
            ],
            "polylines": [],
            "layerItems": [
              {
                "type": "place",
                "id": "2fc07044-f875-4567-8c5b-0b617bbf7d29"
              }
            ]
          }
        ],
        "createdAt": "2026-10-05T07:01:54.791Z",
        "updatedAt": "2026-10-05T07:01:54.791Z"
      },
      "provider": "openwebui",
      "model": "qwen3.5:2b",
      "rawOutput": "{\"version\":1,\"base\":{\"tripId\":\"45843aee-8301-4093-afe1-f583e5ce420f\",\"fingerprint\":\"sha256:73c38dc9c52252a87aa8f8486328a69c5e493acb417ad38157987d6853b832fd\"},\"operations\":[{\"stepId\":\"s1\",\"op\":\"rename_trip\",\"title\":\"시부야를 1일차에서 2일차 마지막으로 옮기고 메모에 야경이라고 적어줘\"},{\"stepId\":\"s2\",\"op\":\"add_day\",\"title\":\"새로운 3일차 추가\"},{\"stepId\":\"s3\",\"op\":\"rename_day\",\"day\":{\"kind\":\"id\",\"id\":\"d9c60b3c-8f87-4edd-9b1c-1de5dab6f7d8\"},\"title\":\"3일차\"},{\"stepId\":\"s4\",\"op\":\"add_place\",\"day\":{\"kind\":\"id\",\"id\":\"d9c60b3c-",
      "commandSequence": [],
      "validation": "NOT_RUN",
      "preview": null,
      "execution": "NOT_RUN",
      "save": "NOT_RUN",
      "reload": "NOT_RUN",
      "after": null,
      "intentMatch": "NOT_RUN",
      "errorsFixes": [
        "PARSER_SCHEMA_FAILURE: json_parse: MODEL_RESPONSE_IS_NOT_ONE_JSON_DOCUMENT"
      ],
      "latency": {
        "modelRequestMs": 10946.100000023842,
        "prepareMs": null,
        "executeMs": null,
        "saveMs": null,
        "reloadMs": null,
        "totalMs": 10968.300000071526
      },
      "status": "FAIL"
    },
    {
      "scenarioId": "T3-C3",
      "request": "3일차를 새로 만들고 이 장소 세 개를 그쪽으로 옮겨줘.",
      "before": {
        "id": "a290a0e9-542d-4d3f-ac53-88413391af4c",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "a6756036-966d-4d37-b31c-ad06967a6559",
            "title": "1일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "ae76d05b-9e0c-4cdf-8dcb-da708262599d",
                "placeId": "fixture-place-shibuya",
                "name": "시부야",
                "location": {
                  "lat": 35.6595,
                  "lng": 139.7005
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              },
              {
                "id": "4b743816-3834-4b8f-bd1c-05694c1665c4",
                "placeId": "fixture-place-ueno",
                "name": "우에노 공원",
                "location": {
                  "lat": 35.7148,
                  "lng": 139.7732
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 2
              },
              {
                "id": "8b396cdf-0b50-44ee-8479-03a93bea5801",
                "placeId": "fixture-place-tower",
                "name": "도쿄 타워",
                "location": {
                  "lat": 35.6586,
                  "lng": 139.7454
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 3
              }
            ],
            "polylines": [
              {
                "id": "daa1cf0c-de56-4168-8bed-467e2e5a2ea6",
                "fromPlaceId": "ae76d05b-9e0c-4cdf-8dcb-da708262599d",
                "toPlaceId": "4b743816-3834-4b8f-bd1c-05694c1665c4",
                "mode": "straight",
                "order": 1
              },
              {
                "id": "262b256e-6c5e-4f9f-a2c3-abf37670ffcf",
                "fromPlaceId": "4b743816-3834-4b8f-bd1c-05694c1665c4",
                "toPlaceId": "8b396cdf-0b50-44ee-8479-03a93bea5801",
                "mode": "straight",
                "order": 2
              }
            ],
            "layerItems": [
              {
                "type": "place",
                "id": "ae76d05b-9e0c-4cdf-8dcb-da708262599d"
              },
              {
                "type": "polyline",
                "id": "daa1cf0c-de56-4168-8bed-467e2e5a2ea6"
              },
              {
                "type": "place",
                "id": "4b743816-3834-4b8f-bd1c-05694c1665c4"
              },
              {
                "type": "polyline",
                "id": "262b256e-6c5e-4f9f-a2c3-abf37670ffcf"
              },
              {
                "type": "place",
                "id": "8b396cdf-0b50-44ee-8479-03a93bea5801"
              }
            ]
          },
          {
            "id": "18fb3bc6-15f4-46ff-b8b3-0ede2d6a16eb",
            "title": "2일차",
            "color": "#2563eb",
            "places": [],
            "polylines": [],
            "layerItems": []
          }
        ],
        "createdAt": "2026-10-05T07:02:05.761Z",
        "updatedAt": "2026-10-05T07:02:05.761Z"
      },
      "provider": "openwebui",
      "model": "qwen3.5:2b",
      "rawOutput": "```json\n{\"version\":1,\"base\":{\"tripId\":\"a290a0e9-542d-4d3f-ac53-88413391af4c\",\"fingerprint\":\"sha256:966cd54738b4b9bcce907bb1a2a73f1ded392eeadc953e34005a02225bc33d20\"},\"operations\":[{\"stepId\":\"s1\",\"op\":\"add_day\",\"title\":\"3일차 추가\"},{\"stepId\":\"s2\",\"op\":\"move_place\",\"place\":{\"kind\":\"id\",\"id\":\"ae76d05b-9e0c-4cdf-8dcb-da708262599d\"},\"day\":{\"kind\":\"id\",\"id\":\"18fb3bc6-15f4-46ff-b8b3-0ede2d6a16eb\"},\"position\":{\"kind\":\"start\"}},{\"stepId\":\"s3\",\"op\":\"move_place\",\"place\":{\"kind\":\"id\",\"id\":\"4b743816-383",
      "commandSequence": [],
      "validation": "NOT_RUN",
      "preview": null,
      "execution": "NOT_RUN",
      "save": "NOT_RUN",
      "reload": "NOT_RUN",
      "after": null,
      "intentMatch": "NOT_RUN",
      "errorsFixes": [
        "PARSER_SCHEMA_FAILURE: json_parse: MODEL_RESPONSE_FORMAT_IS_NOT_RAW_JSON_OR_JSON_FENCE"
      ],
      "latency": {
        "modelRequestMs": 12988.800000071526,
        "prepareMs": null,
        "executeMs": null,
        "saveMs": null,
        "reloadMs": null,
        "totalMs": 13062.199999928474
      },
      "status": "FAIL"
    }
  ]
}
````

## docs/trip-command-t3-evidence-qwen3.5-4b-partial.json

SHA256: `10e2c53661baf2fe7a88bed375028d18dfa4a933c73f40017cd3ff56edbeb93a`; bytes: 4498.

| ID | 원 요청 | 과거 상태 | 오류/수정 |
| --- | --- | --- | --- |
| T3-S05 | 2일차에 아사쿠사를 추가해줘. | BLOCKED | EXTERNAL_PLACE_SOURCE_BLOCKED: GOOGLE_PLACES_API_KEY is missing. |
| T3-C1 | 2일차에 아사쿠사를 추가하고 오후 2시부터 90분 머물게 해줘. | BLOCKED | EXTERNAL_PLACE_SOURCE_BLOCKED: GOOGLE_PLACES_API_KEY is missing. |
| T3-S01 | 여행 이름을 T3 검증 여행 완료로 바꿔줘. | FAIL | PROVIDER_FAILURE: 답변을 불러올 수 없습니다. 잠시 후 다시 시도해 주세요. |
| T3-S02 | 새로운 3일차를 추가해줘. | FAIL | PROVIDER_FAILURE: 답변을 불러올 수 없습니다. 잠시 후 다시 시도해 주세요. |

````json
{
  "contractVersion": "trip-command-plan/v1",
  "startedAt": "2026-10-05T08:19:59.786Z",
  "completedAt": "",
  "records": [
    {
      "scenarioId": "T3-S05",
      "request": "2일차에 아사쿠사를 추가해줘.",
      "before": null,
      "provider": "openwebui",
      "model": "qwen3.5:4b",
      "rawOutput": null,
      "commandSequence": [],
      "validation": "NOT_RUN",
      "preview": null,
      "execution": "NOT_RUN",
      "save": "NOT_RUN",
      "reload": "NOT_RUN",
      "after": null,
      "intentMatch": "NOT_RUN",
      "errorsFixes": [
        "EXTERNAL_PLACE_SOURCE_BLOCKED: GOOGLE_PLACES_API_KEY is missing."
      ],
      "latency": {
        "modelRequestMs": null,
        "prepareMs": null,
        "executeMs": null,
        "saveMs": null,
        "reloadMs": null,
        "totalMs": 0
      },
      "status": "BLOCKED"
    },
    {
      "scenarioId": "T3-C1",
      "request": "2일차에 아사쿠사를 추가하고 오후 2시부터 90분 머물게 해줘.",
      "before": null,
      "provider": "openwebui",
      "model": "qwen3.5:4b",
      "rawOutput": null,
      "commandSequence": [],
      "validation": "NOT_RUN",
      "preview": null,
      "execution": "NOT_RUN",
      "save": "NOT_RUN",
      "reload": "NOT_RUN",
      "after": null,
      "intentMatch": "NOT_RUN",
      "errorsFixes": [
        "EXTERNAL_PLACE_SOURCE_BLOCKED: GOOGLE_PLACES_API_KEY is missing."
      ],
      "latency": {
        "modelRequestMs": null,
        "prepareMs": null,
        "executeMs": null,
        "saveMs": null,
        "reloadMs": null,
        "totalMs": 0
      },
      "status": "BLOCKED"
    },
    {
      "scenarioId": "T3-S01",
      "request": "여행 이름을 T3 검증 여행 완료로 바꿔줘.",
      "before": {
        "id": "cb8fc66d-7e2f-4b68-8070-109051c0635c",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [],
        "createdAt": "2026-10-05T08:19:59.849Z",
        "updatedAt": "2026-10-05T08:19:59.849Z"
      },
      "provider": "openwebui",
      "model": "qwen3.5:4b",
      "rawOutput": null,
      "commandSequence": [],
      "validation": "NOT_RUN",
      "preview": null,
      "execution": "NOT_RUN",
      "save": "NOT_RUN",
      "reload": "NOT_RUN",
      "after": null,
      "intentMatch": "NOT_RUN",
      "errorsFixes": [
        "PROVIDER_FAILURE: 답변을 불러올 수 없습니다. 잠시 후 다시 시도해 주세요."
      ],
      "latency": {
        "modelRequestMs": null,
        "prepareMs": null,
        "executeMs": null,
        "saveMs": null,
        "reloadMs": null,
        "totalMs": 120710.39999997616
      },
      "status": "FAIL"
    },
    {
      "scenarioId": "T3-S02",
      "request": "새로운 3일차를 추가해줘.",
      "before": {
        "id": "37d2b26f-3640-455c-b8a2-a63dcb07c1b4",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "7a853868-8d13-4053-84ca-087380bea603",
            "title": "1일차",
            "color": "#2563eb",
            "places": [],
            "polylines": [],
            "layerItems": []
          },
          {
            "id": "e3ee3d63-244b-4754-86d8-e9ca6e5c87a1",
            "title": "2일차",
            "color": "#2563eb",
            "places": [],
            "polylines": [],
            "layerItems": []
          }
        ],
        "createdAt": "2026-10-05T08:22:00.544Z",
        "updatedAt": "2026-10-05T08:22:00.544Z"
      },
      "provider": "openwebui",
      "model": "qwen3.5:4b",
      "rawOutput": null,
      "commandSequence": [],
      "validation": "NOT_RUN",
      "preview": null,
      "execution": "NOT_RUN",
      "save": "NOT_RUN",
      "reload": "NOT_RUN",
      "after": null,
      "intentMatch": "NOT_RUN",
      "errorsFixes": [
        "PROVIDER_FAILURE: 답변을 불러올 수 없습니다. 잠시 후 다시 시도해 주세요."
      ],
      "latency": {
        "modelRequestMs": null,
        "prepareMs": null,
        "executeMs": null,
        "saveMs": null,
        "reloadMs": null,
        "totalMs": 120511.80000007153
      },
      "status": "FAIL"
    }
  ],
  "runStatus": "ABORTED_AFTER_CONSECUTIVE_PROVIDER_TIMEOUTS",
  "note": "The first two real model requests timed out at the existing 120-second backend limit; the browser session was stopped to avoid further queued requests."
}
````

## docs/trip-command-t3-evidence-qwen3.5-9b.json

SHA256: `4755a320959dfa4cec52718eeac691a926c50e85204dd855aad7990896fde254`; bytes: 72894.

| ID | 원 요청 | 과거 상태 | 오류/수정 |
| --- | --- | --- | --- |
| T3-S05 | 2일차에 아사쿠사를 추가해줘. | BLOCKED | EXTERNAL_PLACE_SOURCE_BLOCKED: GOOGLE_PLACES_API_KEY is missing. |
| T3-C1 | 2일차에 아사쿠사를 추가하고 오후 2시부터 90분 머물게 해줘. | BLOCKED | EXTERNAL_PLACE_SOURCE_BLOCKED: GOOGLE_PLACES_API_KEY is missing. |
| T3-S01 | 여행 이름을 T3 검증 여행 완료로 바꿔줘. | PASS |  |
| T3-S02 | 새로운 3일차를 추가해줘. | PASS |  |
| T3-S03 | 2일차 이름을 둘째 날로 바꿔줘. | FAIL | PROVIDER_FAILURE: 답변을 불러올 수 없습니다. 잠시 후 다시 시도해 주세요. |
| T3-S04 | 3일차를 맨 앞으로 옮겨줘. | PASS |  |
| T3-S06 | 1일차의 우에노 공원을 삭제해줘. | PASS |  |
| T3-S07 | 1일차의 시부야를 2일차 마지막으로 옮겨줘. | FAIL | PROVIDER_FAILURE: 답변을 불러올 수 없습니다. 잠시 후 다시 시도해 주세요. |
| T3-S08 | 1일차의 시부야 이름을 시부야 스카이로 바꿔줘. | PASS |  |
| T3-S09 | 1일차의 시부야 메모를 야경으로 설정해줘. | FAIL | PROVIDER_FAILURE: 답변을 불러올 수 없습니다. 잠시 후 다시 시도해 주세요. |
| T3-S10 | 1일차의 시부야 방문 시작 시간을 오후 2시로 바꿔줘. | FAIL | PROVIDER_FAILURE: 답변을 불러올 수 없습니다. 잠시 후 다시 시도해 주세요. |
| T3-S11 | 1일차의 시부야 방문 시간을 90분으로 바꿔줘. | FAIL | PROVIDER_FAILURE: 답변을 불러올 수 없습니다. 잠시 후 다시 시도해 주세요. |
| T3-S12 | 1일차의 시부야 선호 체류 시간을 120분으로 바꿔줘. | FAIL | PROVIDER_FAILURE: 답변을 불러올 수 없습니다. 잠시 후 다시 시도해 주세요. |
| T3-S13 | 1일차의 시부야에서 도쿄 타워로 이어지는 경로를 도보 모드로 바꿔줘. | FAIL | PROVIDER_FAILURE: 답변을 불러올 수 없습니다. 잠시 후 다시 시도해 주세요. |
| T3-C2 | 시부야를 1일차에서 2일차 마지막으로 옮기고 메모에 야경이라고 적어줘. | FAIL | PROVIDER_FAILURE: 답변을 불러올 수 없습니다. 잠시 후 다시 시도해 주세요. |
| T3-C3 | 3일차를 새로 만들고 이 장소 세 개를 그쪽으로 옮겨줘. | FAIL | PROVIDER_FAILURE: 답변을 불러올 수 없습니다. 잠시 후 다시 시도해 주세요. |

````json
{
  "contractVersion": "trip-command-plan/v1",
  "startedAt": "2026-10-05T07:53:29.879Z",
  "completedAt": "2026-10-05T08:17:23.253Z",
  "records": [
    {
      "scenarioId": "T3-S05",
      "request": "2일차에 아사쿠사를 추가해줘.",
      "before": null,
      "provider": "openwebui",
      "model": "qwen3.5:9b",
      "rawOutput": null,
      "commandSequence": [],
      "validation": "NOT_RUN",
      "preview": null,
      "execution": "NOT_RUN",
      "save": "NOT_RUN",
      "reload": "NOT_RUN",
      "after": null,
      "intentMatch": "NOT_RUN",
      "errorsFixes": [
        "EXTERNAL_PLACE_SOURCE_BLOCKED: GOOGLE_PLACES_API_KEY is missing."
      ],
      "latency": {
        "modelRequestMs": null,
        "prepareMs": null,
        "executeMs": null,
        "saveMs": null,
        "reloadMs": null,
        "totalMs": 0
      },
      "status": "BLOCKED"
    },
    {
      "scenarioId": "T3-C1",
      "request": "2일차에 아사쿠사를 추가하고 오후 2시부터 90분 머물게 해줘.",
      "before": null,
      "provider": "openwebui",
      "model": "qwen3.5:9b",
      "rawOutput": null,
      "commandSequence": [],
      "validation": "NOT_RUN",
      "preview": null,
      "execution": "NOT_RUN",
      "save": "NOT_RUN",
      "reload": "NOT_RUN",
      "after": null,
      "intentMatch": "NOT_RUN",
      "errorsFixes": [
        "EXTERNAL_PLACE_SOURCE_BLOCKED: GOOGLE_PLACES_API_KEY is missing."
      ],
      "latency": {
        "modelRequestMs": null,
        "prepareMs": null,
        "executeMs": null,
        "saveMs": null,
        "reloadMs": null,
        "totalMs": 0
      },
      "status": "BLOCKED"
    },
    {
      "scenarioId": "T3-S01",
      "request": "여행 이름을 T3 검증 여행 완료로 바꿔줘.",
      "before": {
        "id": "15e7e9df-7a9c-4005-988d-56233d787662",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [],
        "createdAt": "2026-10-05T07:53:29.989Z",
        "updatedAt": "2026-10-05T07:53:29.989Z"
      },
      "provider": "openwebui",
      "model": "qwen3.5:9b",
      "rawOutput": "```json\n{\n  \"version\": 1,\n  \"base\": {\n    \"tripId\": \"15e7e9df-7a9c-4005-988d-56233d787662\",\n    \"fingerprint\": \"sha256:5ee245a4fde32739636a591e33e41bf9991996ce8cac09252dd0bbe1e9b77851\"\n  },\n  \"operations\": [\n    {\n      \"stepId\": \"s1\",\n      \"op\": \"rename_trip\",\n      \"title\": \"T3 검증 여행 완료\"\n    }\n  ]\n}\n```",
      "commandSequence": [
        {
          "stepId": "s1",
          "op": "rename_trip",
          "title": "T3 검증 여행 완료"
        }
      ],
      "validation": "PASS",
      "preview": {
        "operationCount": 1,
        "commandCount": 2,
        "diff": [
          {
            "op": "rename_trip",
            "before": "T3 Validation Trip",
            "after": "T3 검증 여행 완료"
          }
        ],
        "risk": {
          "characteristics": ["metadata_edit"]
        },
        "before": {
          "id": "15e7e9df-7a9c-4005-988d-56233d787662",
          "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
          "title": "T3 Validation Trip",
          "days": [],
          "createdAt": "2026-10-05T07:53:29.989Z",
          "updatedAt": "2026-10-05T07:53:29.989Z"
        },
        "after": {
          "id": "15e7e9df-7a9c-4005-988d-56233d787662",
          "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
          "title": "T3 검증 여행 완료",
          "days": [],
          "createdAt": "2026-10-05T07:53:29.989Z",
          "updatedAt": "2026-10-05T07:53:29.989Z"
        }
      },
      "execution": "PASS",
      "save": "PASS",
      "reload": "PASS",
      "after": {
        "id": "15e7e9df-7a9c-4005-988d-56233d787662",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 검증 여행 완료",
        "days": [],
        "createdAt": "2026-10-05T07:53:29.989Z",
        "updatedAt": "2026-10-05T07:54:21.883Z"
      },
      "intentMatch": "PASS",
      "errorsFixes": [],
      "latency": {
        "modelRequestMs": 51707.39999997616,
        "prepareMs": 14.700000047683716,
        "executeMs": 2,
        "saveMs": 29.800000071525574,
        "reloadMs": 14,
        "totalMs": 52014.700000047684
      },
      "status": "PASS"
    },
    {
      "scenarioId": "T3-S02",
      "request": "새로운 3일차를 추가해줘.",
      "before": {
        "id": "decd2411-7466-4bac-a936-820d25b670b2",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "b319ebcc-1125-455a-bcb6-a7bb56a236ba",
            "title": "1일차",
            "color": "#2563eb",
            "places": [],
            "polylines": [],
            "layerItems": []
          },
          {
            "id": "d53c0eba-4ed2-4f7c-ad13-cab826c46f49",
            "title": "2일차",
            "color": "#2563eb",
            "places": [],
            "polylines": [],
            "layerItems": []
          }
        ],
        "createdAt": "2026-10-05T07:54:21.925Z",
        "updatedAt": "2026-10-05T07:54:21.925Z"
      },
      "provider": "openwebui",
      "model": "qwen3.5:9b",
      "rawOutput": "```json\n{\n  \"version\": 1,\n  \"base\": {\n    \"tripId\": \"decd2411-7466-4bac-a936-820d25b670b2\",\n    \"fingerprint\": \"sha256:5b52a11895caf79d2648a1f0f5fa0d9556f5307d943f3efbaedff24ae1466fd6\"\n  },\n  \"operations\": [\n    {\n      \"stepId\": \"s1\",\n      \"op\": \"add_day\",\n      \"title\": \"3일차\"\n    }\n  ]\n}\n```",
      "commandSequence": [
        {
          "stepId": "s1",
          "op": "add_day",
          "title": "3일차"
        }
      ],
      "validation": "PASS",
      "preview": {
        "operationCount": 1,
        "commandCount": 2,
        "diff": [
          {
            "op": "add_day",
            "dayId": "pending-ab665e6c-9738-4cbd-915a-234716b1724f",
            "title": "3일차",
            "index": 2
          }
        ],
        "risk": {
          "characteristics": ["structural_change"]
        },
        "before": {
          "id": "decd2411-7466-4bac-a936-820d25b670b2",
          "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
          "title": "T3 Validation Trip",
          "days": [
            {
              "id": "b319ebcc-1125-455a-bcb6-a7bb56a236ba",
              "title": "1일차",
              "color": "#2563eb",
              "places": [],
              "polylines": [],
              "layerItems": []
            },
            {
              "id": "d53c0eba-4ed2-4f7c-ad13-cab826c46f49",
              "title": "2일차",
              "color": "#2563eb",
              "places": [],
              "polylines": [],
              "layerItems": []
            }
          ],
          "createdAt": "2026-10-05T07:54:21.925Z",
          "updatedAt": "2026-10-05T07:54:21.925Z"
        },
        "after": {
          "id": "decd2411-7466-4bac-a936-820d25b670b2",
          "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
          "title": "T3 Validation Trip",
          "days": [
            {
              "id": "b319ebcc-1125-455a-bcb6-a7bb56a236ba",
              "title": "1일차",
              "color": "#2563eb",
              "places": [],
              "polylines": [],
              "layerItems": []
            },
            {
              "id": "d53c0eba-4ed2-4f7c-ad13-cab826c46f49",
              "title": "2일차",
              "color": "#2563eb",
              "places": [],
              "polylines": [],
              "layerItems": []
            },
            {
              "id": "pending-ab665e6c-9738-4cbd-915a-234716b1724f",
              "title": "3일차",
              "color": "#ca8a04",
              "places": [],
              "polylines": [],
              "layerItems": []
            }
          ],
          "createdAt": "2026-10-05T07:54:21.925Z",
          "updatedAt": "2026-10-05T07:54:21.925Z"
        }
      },
      "execution": "PASS",
      "save": "PASS",
      "reload": "PASS",
      "after": {
        "id": "decd2411-7466-4bac-a936-820d25b670b2",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "b319ebcc-1125-455a-bcb6-a7bb56a236ba",
            "title": "1일차",
            "color": "#2563eb",
            "places": [],
            "polylines": [],
            "layerItems": []
          },
          {
            "id": "d53c0eba-4ed2-4f7c-ad13-cab826c46f49",
            "title": "2일차",
            "color": "#2563eb",
            "places": [],
            "polylines": [],
            "layerItems": []
          },
          {
            "id": "e7c09d21-e821-4020-ba78-043dac90769b",
            "title": "3일차",
            "color": "#db2777",
            "places": [],
            "polylines": [],
            "layerItems": []
          }
        ],
        "createdAt": "2026-10-05T07:54:21.925Z",
        "updatedAt": "2026-10-05T07:54:57.264Z"
      },
      "intentMatch": "PASS",
      "errorsFixes": [],
      "latency": {
        "modelRequestMs": 35208.700000047684,
        "prepareMs": 16.800000071525574,
        "executeMs": 0.2999999523162842,
        "saveMs": 28,
        "reloadMs": 7.699999928474426,
        "totalMs": 35387
      },
      "status": "PASS"
    },
    {
      "scenarioId": "T3-S03",
      "request": "2일차 이름을 둘째 날로 바꿔줘.",
      "before": {
        "id": "d83a00bb-0a57-475e-b267-b1caac86fd64",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "373f19f2-eed5-4ec6-be52-3fc9d9863a20",
            "title": "1일차",
            "color": "#2563eb",
            "places": [],
            "polylines": [],
            "layerItems": []
          },
          {
            "id": "7a6bf7f7-e4a3-4b85-9f0a-03bc553da4bb",
            "title": "2일차",
            "color": "#2563eb",
            "places": [],
            "polylines": [],
            "layerItems": []
          }
        ],
        "createdAt": "2026-10-05T07:54:57.306Z",
        "updatedAt": "2026-10-05T07:54:57.306Z"
      },
      "provider": "openwebui",
      "model": "qwen3.5:9b",
      "rawOutput": null,
      "commandSequence": [],
      "validation": "NOT_RUN",
      "preview": null,
      "execution": "NOT_RUN",
      "save": "NOT_RUN",
      "reload": "NOT_RUN",
      "after": null,
      "intentMatch": "NOT_RUN",
      "errorsFixes": [
        "PROVIDER_FAILURE: 답변을 불러올 수 없습니다. 잠시 후 다시 시도해 주세요."
      ],
      "latency": {
        "modelRequestMs": null,
        "prepareMs": null,
        "executeMs": null,
        "saveMs": null,
        "reloadMs": null,
        "totalMs": 120443.29999995232
      },
      "status": "FAIL"
    },
    {
      "scenarioId": "T3-S04",
      "request": "3일차를 맨 앞으로 옮겨줘.",
      "before": {
        "id": "88013e8f-349b-4417-81c2-0651dfe35bcf",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "7ab1564f-ba43-40e5-aefd-13c802a716b2",
            "title": "1일차",
            "color": "#2563eb",
            "places": [],
            "polylines": [],
            "layerItems": []
          },
          {
            "id": "5dd944b1-9eb1-4af0-96b2-372ba14c6f5b",
            "title": "2일차",
            "color": "#2563eb",
            "places": [],
            "polylines": [],
            "layerItems": []
          },
          {
            "id": "1d6819cd-c261-4fe4-9424-66bee17141aa",
            "title": "3일차",
            "color": "#2563eb",
            "places": [],
            "polylines": [],
            "layerItems": []
          }
        ],
        "createdAt": "2026-10-05T07:56:57.791Z",
        "updatedAt": "2026-10-05T07:56:57.791Z"
      },
      "provider": "openwebui",
      "model": "qwen3.5:9b",
      "rawOutput": "```json\n{\"version\":1,\"base\":{\"tripId\":\"88013e8f-349b-4417-81c2-0651dfe35bcf\",\"fingerprint\":\"sha256:c9a671a11232834ff6914bf213cfc523444a98c280307e58b36e0d22cc12e641\"},\"operations\":[{\"stepId\":\"s1\",\"op\":\"move_day\",\"day\":{\"kind\":\"id\",\"id\":\"1d6819cd-c261-4fe4-9424-66bee17141aa\"},\"position\":{\"kind\":\"start\"}}]}\n```",
      "commandSequence": [
        {
          "stepId": "s1",
          "op": "move_day",
          "day": {
            "kind": "id",
            "id": "1d6819cd-c261-4fe4-9424-66bee17141aa"
          },
          "position": {
            "kind": "start"
          }
        }
      ],
      "validation": "PASS",
      "preview": {
        "operationCount": 1,
        "commandCount": 2,
        "diff": [
          {
            "op": "move_day",
            "dayId": "1d6819cd-c261-4fe4-9424-66bee17141aa",
            "beforeIndex": 2,
            "afterIndex": 0
          },
          {
            "op": "move_day",
            "dayId": "7ab1564f-ba43-40e5-aefd-13c802a716b2",
            "beforeIndex": 0,
            "afterIndex": 1
          },
          {
            "op": "move_day",
            "dayId": "5dd944b1-9eb1-4af0-96b2-372ba14c6f5b",
            "beforeIndex": 1,
            "afterIndex": 2
          }
        ],
        "risk": {
          "characteristics": ["structural_change"]
        },
        "before": {
          "id": "88013e8f-349b-4417-81c2-0651dfe35bcf",
          "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
          "title": "T3 Validation Trip",
          "days": [
            {
              "id": "7ab1564f-ba43-40e5-aefd-13c802a716b2",
              "title": "1일차",
              "color": "#2563eb",
              "places": [],
              "polylines": [],
              "layerItems": []
            },
            {
              "id": "5dd944b1-9eb1-4af0-96b2-372ba14c6f5b",
              "title": "2일차",
              "color": "#2563eb",
              "places": [],
              "polylines": [],
              "layerItems": []
            },
            {
              "id": "1d6819cd-c261-4fe4-9424-66bee17141aa",
              "title": "3일차",
              "color": "#2563eb",
              "places": [],
              "polylines": [],
              "layerItems": []
            }
          ],
          "createdAt": "2026-10-05T07:56:57.791Z",
          "updatedAt": "2026-10-05T07:56:57.791Z"
        },
        "after": {
          "id": "88013e8f-349b-4417-81c2-0651dfe35bcf",
          "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
          "title": "T3 Validation Trip",
          "days": [
            {
              "id": "1d6819cd-c261-4fe4-9424-66bee17141aa",
              "title": "3일차",
              "color": "#2563eb",
              "places": [],
              "polylines": [],
              "layerItems": []
            },
            {
              "id": "7ab1564f-ba43-40e5-aefd-13c802a716b2",
              "title": "1일차",
              "color": "#2563eb",
              "places": [],
              "polylines": [],
              "layerItems": []
            },
            {
              "id": "5dd944b1-9eb1-4af0-96b2-372ba14c6f5b",
              "title": "2일차",
              "color": "#2563eb",
              "places": [],
              "polylines": [],
              "layerItems": []
            }
          ],
          "createdAt": "2026-10-05T07:56:57.791Z",
          "updatedAt": "2026-10-05T07:56:57.791Z"
        }
      },
      "execution": "PASS",
      "save": "PASS",
      "reload": "PASS",
      "after": {
        "id": "88013e8f-349b-4417-81c2-0651dfe35bcf",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "1d6819cd-c261-4fe4-9424-66bee17141aa",
            "title": "3일차",
            "color": "#2563eb",
            "places": [],
            "polylines": [],
            "layerItems": []
          },
          {
            "id": "7ab1564f-ba43-40e5-aefd-13c802a716b2",
            "title": "1일차",
            "color": "#2563eb",
            "places": [],
            "polylines": [],
            "layerItems": []
          },
          {
            "id": "5dd944b1-9eb1-4af0-96b2-372ba14c6f5b",
            "title": "2일차",
            "color": "#2563eb",
            "places": [],
            "polylines": [],
            "layerItems": []
          }
        ],
        "createdAt": "2026-10-05T07:56:57.791Z",
        "updatedAt": "2026-10-05T07:58:49.177Z"
      },
      "intentMatch": "PASS",
      "errorsFixes": [],
      "latency": {
        "modelRequestMs": 111109.79999995232,
        "prepareMs": 16.700000047683716,
        "executeMs": 2.8000000715255737,
        "saveMs": 63.40000009536743,
        "reloadMs": 5.199999928474426,
        "totalMs": 111484.69999992847
      },
      "status": "PASS"
    },
    {
      "scenarioId": "T3-S06",
      "request": "1일차의 우에노 공원을 삭제해줘.",
      "before": {
        "id": "7d739e56-1db4-427a-a698-22b7a248d7a3",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "ffd97024-37de-496c-9db3-2a1837c841fe",
            "title": "1일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "db6d5e97-3900-422d-9181-588821f43e71",
                "placeId": "fixture-place-shibuya",
                "name": "시부야",
                "location": {
                  "lat": 35.6595,
                  "lng": 139.7005
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              },
              {
                "id": "ec355589-89a8-4422-a0ba-e5d3dc6b0288",
                "placeId": "fixture-place-ueno",
                "name": "우에노 공원",
                "location": {
                  "lat": 35.7148,
                  "lng": 139.7732
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 2
              }
            ],
            "polylines": [
              {
                "id": "b2fc8b98-716b-44d8-93f1-ce857e004d2c",
                "fromPlaceId": "db6d5e97-3900-422d-9181-588821f43e71",
                "toPlaceId": "ec355589-89a8-4422-a0ba-e5d3dc6b0288",
                "mode": "straight",
                "order": 1
              }
            ],
            "layerItems": [
              {
                "type": "place",
                "id": "db6d5e97-3900-422d-9181-588821f43e71"
              },
              {
                "type": "polyline",
                "id": "b2fc8b98-716b-44d8-93f1-ce857e004d2c"
              },
              {
                "type": "place",
                "id": "ec355589-89a8-4422-a0ba-e5d3dc6b0288"
              }
            ]
          },
          {
            "id": "dce02ac6-20b1-4407-ad33-c00f763b4af9",
            "title": "2일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "782a0273-0d2c-4172-a5b7-2695c07ce2c5",
                "placeId": "fixture-place-tower",
                "name": "도쿄 타워",
                "location": {
                  "lat": 35.6586,
                  "lng": 139.7454
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              }
            ],
            "polylines": [],
            "layerItems": [
              {
                "type": "place",
                "id": "782a0273-0d2c-4172-a5b7-2695c07ce2c5"
              }
            ]
          }
        ],
        "createdAt": "2026-10-05T07:58:49.273Z",
        "updatedAt": "2026-10-05T07:58:49.273Z"
      },
      "provider": "openwebui",
      "model": "qwen3.5:9b",
      "rawOutput": "{\"version\":1,\"base\":{\"tripId\":\"7d739e56-1db4-427a-a698-22b7a248d7a3\",\"fingerprint\":\"sha256:9f9391fa3e3e231ffd54bc7461407f212a1e3fad32b85a9bd13f2d09c78d61ef\"},\"operations\":[{\"stepId\":\"s1\",\"op\":\"remove_place\",\"place\":{\"kind\":\"id\",\"id\":\"ec355589-89a8-4422-a0ba-e5d3dc6b0288\"}}]}",
      "commandSequence": [
        {
          "stepId": "s1",
          "op": "remove_place",
          "place": {
            "kind": "id",
            "id": "ec355589-89a8-4422-a0ba-e5d3dc6b0288"
          }
        }
      ],
      "validation": "PASS",
      "preview": {
        "operationCount": 1,
        "commandCount": 2,
        "diff": [
          {
            "op": "remove_place",
            "placeId": "ec355589-89a8-4422-a0ba-e5d3dc6b0288",
            "dayId": "ffd97024-37de-496c-9db3-2a1837c841fe",
            "index": 1,
            "name": "우에노 공원"
          }
        ],
        "risk": {
          "characteristics": ["destructive_removal"]
        },
        "before": {
          "id": "7d739e56-1db4-427a-a698-22b7a248d7a3",
          "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
          "title": "T3 Validation Trip",
          "days": [
            {
              "id": "ffd97024-37de-496c-9db3-2a1837c841fe",
              "title": "1일차",
              "color": "#2563eb",
              "places": [
                {
                  "id": "db6d5e97-3900-422d-9181-588821f43e71",
                  "placeId": "fixture-place-shibuya",
                  "name": "시부야",
                  "location": {
                    "lat": 35.6595,
                    "lng": 139.7005
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 1
                },
                {
                  "id": "ec355589-89a8-4422-a0ba-e5d3dc6b0288",
                  "placeId": "fixture-place-ueno",
                  "name": "우에노 공원",
                  "location": {
                    "lat": 35.7148,
                    "lng": 139.7732
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 2
                }
              ],
              "polylines": [
                {
                  "id": "b2fc8b98-716b-44d8-93f1-ce857e004d2c",
                  "fromPlaceId": "db6d5e97-3900-422d-9181-588821f43e71",
                  "toPlaceId": "ec355589-89a8-4422-a0ba-e5d3dc6b0288",
                  "mode": "straight",
                  "order": 1
                }
              ],
              "layerItems": [
                {
                  "type": "place",
                  "id": "db6d5e97-3900-422d-9181-588821f43e71"
                },
                {
                  "type": "polyline",
                  "id": "b2fc8b98-716b-44d8-93f1-ce857e004d2c"
                },
                {
                  "type": "place",
                  "id": "ec355589-89a8-4422-a0ba-e5d3dc6b0288"
                }
              ]
            },
            {
              "id": "dce02ac6-20b1-4407-ad33-c00f763b4af9",
              "title": "2일차",
              "color": "#2563eb",
              "places": [
                {
                  "id": "782a0273-0d2c-4172-a5b7-2695c07ce2c5",
                  "placeId": "fixture-place-tower",
                  "name": "도쿄 타워",
                  "location": {
                    "lat": 35.6586,
                    "lng": 139.7454
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 1
                }
              ],
              "polylines": [],
              "layerItems": [
                {
                  "type": "place",
                  "id": "782a0273-0d2c-4172-a5b7-2695c07ce2c5"
                }
              ]
            }
          ],
          "createdAt": "2026-10-05T07:58:49.273Z",
          "updatedAt": "2026-10-05T07:58:49.273Z"
        },
        "after": {
          "id": "7d739e56-1db4-427a-a698-22b7a248d7a3",
          "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
          "title": "T3 Validation Trip",
          "days": [
            {
              "id": "ffd97024-37de-496c-9db3-2a1837c841fe",
              "title": "1일차",
              "color": "#2563eb",
              "places": [
                {
                  "id": "db6d5e97-3900-422d-9181-588821f43e71",
                  "placeId": "fixture-place-shibuya",
                  "name": "시부야",
                  "location": {
                    "lat": 35.6595,
                    "lng": 139.7005
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 1
                }
              ],
              "polylines": [],
              "layerItems": [
                {
                  "type": "place",
                  "id": "db6d5e97-3900-422d-9181-588821f43e71"
                }
              ]
            },
            {
              "id": "dce02ac6-20b1-4407-ad33-c00f763b4af9",
              "title": "2일차",
              "color": "#2563eb",
              "places": [
                {
                  "id": "782a0273-0d2c-4172-a5b7-2695c07ce2c5",
                  "placeId": "fixture-place-tower",
                  "name": "도쿄 타워",
                  "location": {
                    "lat": 35.6586,
                    "lng": 139.7454
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 1
                }
              ],
              "polylines": [],
              "layerItems": [
                {
                  "type": "place",
                  "id": "782a0273-0d2c-4172-a5b7-2695c07ce2c5"
                }
              ]
            }
          ],
          "createdAt": "2026-10-05T07:58:49.273Z",
          "updatedAt": "2026-10-05T07:58:49.273Z"
        }
      },
      "execution": "PASS",
      "save": "PASS",
      "reload": "PASS",
      "after": {
        "id": "7d739e56-1db4-427a-a698-22b7a248d7a3",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "ffd97024-37de-496c-9db3-2a1837c841fe",
            "title": "1일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "db6d5e97-3900-422d-9181-588821f43e71",
                "placeId": "fixture-place-shibuya",
                "name": "시부야",
                "location": {
                  "lat": 35.6595,
                  "lng": 139.7005
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              }
            ],
            "polylines": [],
            "layerItems": [
              {
                "type": "place",
                "id": "db6d5e97-3900-422d-9181-588821f43e71"
              }
            ]
          },
          {
            "id": "dce02ac6-20b1-4407-ad33-c00f763b4af9",
            "title": "2일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "782a0273-0d2c-4172-a5b7-2695c07ce2c5",
                "placeId": "fixture-place-tower",
                "name": "도쿄 타워",
                "location": {
                  "lat": 35.6586,
                  "lng": 139.7454
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              }
            ],
            "polylines": [],
            "layerItems": [
              {
                "type": "place",
                "id": "782a0273-0d2c-4172-a5b7-2695c07ce2c5"
              }
            ]
          }
        ],
        "createdAt": "2026-10-05T07:58:49.273Z",
        "updatedAt": "2026-10-05T07:59:52.765Z"
      },
      "intentMatch": "PASS",
      "errorsFixes": [],
      "latency": {
        "modelRequestMs": 63307,
        "prepareMs": 19.5,
        "executeMs": 1.5,
        "saveMs": 47,
        "reloadMs": 5.899999976158142,
        "totalMs": 63570.5
      },
      "status": "PASS"
    },
    {
      "scenarioId": "T3-S07",
      "request": "1일차의 시부야를 2일차 마지막으로 옮겨줘.",
      "before": {
        "id": "df94f884-6470-4db6-ab28-1d9811e20259",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "f389f111-b46e-4655-829e-d8fcc8e90d72",
            "title": "1일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "b94374b3-23c1-46d1-b347-56649f591bc2",
                "placeId": "fixture-place-shibuya",
                "name": "시부야",
                "location": {
                  "lat": 35.6595,
                  "lng": 139.7005
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              },
              {
                "id": "79d9506a-c3a2-4a31-bc89-ed100b95d279",
                "placeId": "fixture-place-ueno",
                "name": "우에노 공원",
                "location": {
                  "lat": 35.7148,
                  "lng": 139.7732
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 2
              }
            ],
            "polylines": [
              {
                "id": "5861ddb6-37f8-42ea-ae27-a37853afb122",
                "fromPlaceId": "b94374b3-23c1-46d1-b347-56649f591bc2",
                "toPlaceId": "79d9506a-c3a2-4a31-bc89-ed100b95d279",
                "mode": "straight",
                "order": 1
              }
            ],
            "layerItems": [
              {
                "type": "place",
                "id": "b94374b3-23c1-46d1-b347-56649f591bc2"
              },
              {
                "type": "polyline",
                "id": "5861ddb6-37f8-42ea-ae27-a37853afb122"
              },
              {
                "type": "place",
                "id": "79d9506a-c3a2-4a31-bc89-ed100b95d279"
              }
            ]
          },
          {
            "id": "7d990e78-ac9b-4e86-8ad5-6ab10b261d51",
            "title": "2일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "9e68350b-f9ff-4e5b-8a35-6ca6f2d12bf0",
                "placeId": "fixture-place-tower",
                "name": "도쿄 타워",
                "location": {
                  "lat": 35.6586,
                  "lng": 139.7454
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              }
            ],
            "polylines": [],
            "layerItems": [
              {
                "type": "place",
                "id": "9e68350b-f9ff-4e5b-8a35-6ca6f2d12bf0"
              }
            ]
          }
        ],
        "createdAt": "2026-10-05T07:59:52.818Z",
        "updatedAt": "2026-10-05T07:59:52.818Z"
      },
      "provider": "openwebui",
      "model": "qwen3.5:9b",
      "rawOutput": null,
      "commandSequence": [],
      "validation": "NOT_RUN",
      "preview": null,
      "execution": "NOT_RUN",
      "save": "NOT_RUN",
      "reload": "NOT_RUN",
      "after": null,
      "intentMatch": "NOT_RUN",
      "errorsFixes": [
        "PROVIDER_FAILURE: 답변을 불러올 수 없습니다. 잠시 후 다시 시도해 주세요."
      ],
      "latency": {
        "modelRequestMs": null,
        "prepareMs": null,
        "executeMs": null,
        "saveMs": null,
        "reloadMs": null,
        "totalMs": 120167.09999990463
      },
      "status": "FAIL"
    },
    {
      "scenarioId": "T3-S08",
      "request": "1일차의 시부야 이름을 시부야 스카이로 바꿔줘.",
      "before": {
        "id": "018e008c-e482-4c87-9d4b-eb6586454f4a",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "f49535a7-024f-4459-884b-31033aafe2d9",
            "title": "1일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "b5c1821e-5f65-42b0-b47e-ebe66b8a7058",
                "placeId": "fixture-place-shibuya",
                "name": "시부야",
                "location": {
                  "lat": 35.6595,
                  "lng": 139.7005
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              },
              {
                "id": "69917cad-8167-49f7-b02a-aa5d9fddd6f2",
                "placeId": "fixture-place-ueno",
                "name": "우에노 공원",
                "location": {
                  "lat": 35.7148,
                  "lng": 139.7732
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 2
              }
            ],
            "polylines": [
              {
                "id": "8f0b8f3c-dbde-45b5-b4ab-78e7a3b0f2af",
                "fromPlaceId": "b5c1821e-5f65-42b0-b47e-ebe66b8a7058",
                "toPlaceId": "69917cad-8167-49f7-b02a-aa5d9fddd6f2",
                "mode": "straight",
                "order": 1
              }
            ],
            "layerItems": [
              {
                "type": "place",
                "id": "b5c1821e-5f65-42b0-b47e-ebe66b8a7058"
              },
              {
                "type": "polyline",
                "id": "8f0b8f3c-dbde-45b5-b4ab-78e7a3b0f2af"
              },
              {
                "type": "place",
                "id": "69917cad-8167-49f7-b02a-aa5d9fddd6f2"
              }
            ]
          },
          {
            "id": "0b34cc52-95c0-456a-bbd4-8f5740c36b07",
            "title": "2일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "02ec118a-53fc-4424-8f60-26285d951bdb",
                "placeId": "fixture-place-tower",
                "name": "도쿄 타워",
                "location": {
                  "lat": 35.6586,
                  "lng": 139.7454
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              }
            ],
            "polylines": [],
            "layerItems": [
              {
                "type": "place",
                "id": "02ec118a-53fc-4424-8f60-26285d951bdb"
              }
            ]
          }
        ],
        "createdAt": "2026-10-05T08:01:53.001Z",
        "updatedAt": "2026-10-05T08:01:53.001Z"
      },
      "provider": "openwebui",
      "model": "qwen3.5:9b",
      "rawOutput": "```json\n{\"version\":1,\"base\":{\"tripId\":\"018e008c-e482-4c87-9d4b-eb6586454f4a\",\"fingerprint\":\"sha256:f42d4bfbd20bda15a79a756f4cc0e57aec9a90a0eef0b1f1f15e52b9cb785e02\"},\"operations\":[{\"stepId\":\"s1\",\"op\":\"rename_place\",\"place\":{\"kind\":\"id\",\"id\":\"b5c1821e-5f65-42b0-b47e-ebe66b8a7058\"},\"name\":\"시부야 스카이\"}]}\n```",
      "commandSequence": [
        {
          "stepId": "s1",
          "op": "rename_place",
          "place": {
            "kind": "id",
            "id": "b5c1821e-5f65-42b0-b47e-ebe66b8a7058"
          },
          "name": "시부야 스카이"
        }
      ],
      "validation": "PASS",
      "preview": {
        "operationCount": 1,
        "commandCount": 2,
        "diff": [
          {
            "op": "rename_place",
            "placeId": "b5c1821e-5f65-42b0-b47e-ebe66b8a7058",
            "before": "시부야",
            "after": "시부야 스카이"
          }
        ],
        "risk": {
          "characteristics": ["metadata_edit"]
        },
        "before": {
          "id": "018e008c-e482-4c87-9d4b-eb6586454f4a",
          "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
          "title": "T3 Validation Trip",
          "days": [
            {
              "id": "f49535a7-024f-4459-884b-31033aafe2d9",
              "title": "1일차",
              "color": "#2563eb",
              "places": [
                {
                  "id": "b5c1821e-5f65-42b0-b47e-ebe66b8a7058",
                  "placeId": "fixture-place-shibuya",
                  "name": "시부야",
                  "location": {
                    "lat": 35.6595,
                    "lng": 139.7005
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 1
                },
                {
                  "id": "69917cad-8167-49f7-b02a-aa5d9fddd6f2",
                  "placeId": "fixture-place-ueno",
                  "name": "우에노 공원",
                  "location": {
                    "lat": 35.7148,
                    "lng": 139.7732
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 2
                }
              ],
              "polylines": [
                {
                  "id": "8f0b8f3c-dbde-45b5-b4ab-78e7a3b0f2af",
                  "fromPlaceId": "b5c1821e-5f65-42b0-b47e-ebe66b8a7058",
                  "toPlaceId": "69917cad-8167-49f7-b02a-aa5d9fddd6f2",
                  "mode": "straight",
                  "order": 1
                }
              ],
              "layerItems": [
                {
                  "type": "place",
                  "id": "b5c1821e-5f65-42b0-b47e-ebe66b8a7058"
                },
                {
                  "type": "polyline",
                  "id": "8f0b8f3c-dbde-45b5-b4ab-78e7a3b0f2af"
                },
                {
                  "type": "place",
                  "id": "69917cad-8167-49f7-b02a-aa5d9fddd6f2"
                }
              ]
            },
            {
              "id": "0b34cc52-95c0-456a-bbd4-8f5740c36b07",
              "title": "2일차",
              "color": "#2563eb",
              "places": [
                {
                  "id": "02ec118a-53fc-4424-8f60-26285d951bdb",
                  "placeId": "fixture-place-tower",
                  "name": "도쿄 타워",
                  "location": {
                    "lat": 35.6586,
                    "lng": 139.7454
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 1
                }
              ],
              "polylines": [],
              "layerItems": [
                {
                  "type": "place",
                  "id": "02ec118a-53fc-4424-8f60-26285d951bdb"
                }
              ]
            }
          ],
          "createdAt": "2026-10-05T08:01:53.001Z",
          "updatedAt": "2026-10-05T08:01:53.001Z"
        },
        "after": {
          "id": "018e008c-e482-4c87-9d4b-eb6586454f4a",
          "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
          "title": "T3 Validation Trip",
          "days": [
            {
              "id": "f49535a7-024f-4459-884b-31033aafe2d9",
              "title": "1일차",
              "color": "#2563eb",
              "places": [
                {
                  "id": "b5c1821e-5f65-42b0-b47e-ebe66b8a7058",
                  "placeId": "fixture-place-shibuya",
                  "name": "시부야 스카이",
                  "location": {
                    "lat": 35.6595,
                    "lng": 139.7005
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 1
                },
                {
                  "id": "69917cad-8167-49f7-b02a-aa5d9fddd6f2",
                  "placeId": "fixture-place-ueno",
                  "name": "우에노 공원",
                  "location": {
                    "lat": 35.7148,
                    "lng": 139.7732
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 2
                }
              ],
              "polylines": [
                {
                  "id": "8f0b8f3c-dbde-45b5-b4ab-78e7a3b0f2af",
                  "fromPlaceId": "b5c1821e-5f65-42b0-b47e-ebe66b8a7058",
                  "toPlaceId": "69917cad-8167-49f7-b02a-aa5d9fddd6f2",
                  "mode": "straight",
                  "order": 1
                }
              ],
              "layerItems": [
                {
                  "type": "place",
                  "id": "b5c1821e-5f65-42b0-b47e-ebe66b8a7058"
                },
                {
                  "type": "polyline",
                  "id": "8f0b8f3c-dbde-45b5-b4ab-78e7a3b0f2af"
                },
                {
                  "type": "place",
                  "id": "69917cad-8167-49f7-b02a-aa5d9fddd6f2"
                }
              ]
            },
            {
              "id": "0b34cc52-95c0-456a-bbd4-8f5740c36b07",
              "title": "2일차",
              "color": "#2563eb",
              "places": [
                {
                  "id": "02ec118a-53fc-4424-8f60-26285d951bdb",
                  "placeId": "fixture-place-tower",
                  "name": "도쿄 타워",
                  "location": {
                    "lat": 35.6586,
                    "lng": 139.7454
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 1
                }
              ],
              "polylines": [],
              "layerItems": [
                {
                  "type": "place",
                  "id": "02ec118a-53fc-4424-8f60-26285d951bdb"
                }
              ]
            }
          ],
          "createdAt": "2026-10-05T08:01:53.001Z",
          "updatedAt": "2026-10-05T08:01:53.001Z"
        }
      },
      "execution": "PASS",
      "save": "PASS",
      "reload": "PASS",
      "after": {
        "id": "018e008c-e482-4c87-9d4b-eb6586454f4a",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "f49535a7-024f-4459-884b-31033aafe2d9",
            "title": "1일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "b5c1821e-5f65-42b0-b47e-ebe66b8a7058",
                "placeId": "fixture-place-shibuya",
                "name": "시부야 스카이",
                "location": {
                  "lat": 35.6595,
                  "lng": 139.7005
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              },
              {
                "id": "69917cad-8167-49f7-b02a-aa5d9fddd6f2",
                "placeId": "fixture-place-ueno",
                "name": "우에노 공원",
                "location": {
                  "lat": 35.7148,
                  "lng": 139.7732
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 2
              }
            ],
            "polylines": [
              {
                "id": "8f0b8f3c-dbde-45b5-b4ab-78e7a3b0f2af",
                "fromPlaceId": "b5c1821e-5f65-42b0-b47e-ebe66b8a7058",
                "toPlaceId": "69917cad-8167-49f7-b02a-aa5d9fddd6f2",
                "mode": "straight",
                "order": 1
              }
            ],
            "layerItems": [
              {
                "type": "place",
                "id": "b5c1821e-5f65-42b0-b47e-ebe66b8a7058"
              },
              {
                "type": "polyline",
                "id": "8f0b8f3c-dbde-45b5-b4ab-78e7a3b0f2af"
              },
              {
                "type": "place",
                "id": "69917cad-8167-49f7-b02a-aa5d9fddd6f2"
              }
            ]
          },
          {
            "id": "0b34cc52-95c0-456a-bbd4-8f5740c36b07",
            "title": "2일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "02ec118a-53fc-4424-8f60-26285d951bdb",
                "placeId": "fixture-place-tower",
                "name": "도쿄 타워",
                "location": {
                  "lat": 35.6586,
                  "lng": 139.7454
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              }
            ],
            "polylines": [],
            "layerItems": [
              {
                "type": "place",
                "id": "02ec118a-53fc-4424-8f60-26285d951bdb"
              }
            ]
          }
        ],
        "createdAt": "2026-10-05T08:01:53.001Z",
        "updatedAt": "2026-10-05T08:03:20.892Z"
      },
      "intentMatch": "PASS",
      "errorsFixes": [],
      "latency": {
        "modelRequestMs": 87719.69999992847,
        "prepareMs": 13.799999952316284,
        "executeMs": 1.7999999523162842,
        "saveMs": 40,
        "reloadMs": 5.299999952316284,
        "totalMs": 87930.09999990463
      },
      "status": "PASS"
    },
    {
      "scenarioId": "T3-S09",
      "request": "1일차의 시부야 메모를 야경으로 설정해줘.",
      "before": {
        "id": "1505d28d-88fc-42dd-9f7c-c874dea8f9ee",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "c087fe89-8cf6-4bf3-bc45-4425a01f547f",
            "title": "1일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "903ef473-23a2-4114-baf2-d6e51b6a817f",
                "placeId": "fixture-place-shibuya",
                "name": "시부야",
                "location": {
                  "lat": 35.6595,
                  "lng": 139.7005
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              },
              {
                "id": "0b1c1c57-b1c0-4eae-bf6a-028844cb5bef",
                "placeId": "fixture-place-ueno",
                "name": "우에노 공원",
                "location": {
                  "lat": 35.7148,
                  "lng": 139.7732
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 2
              }
            ],
            "polylines": [
              {
                "id": "1ba3a62e-7319-43d6-9398-885414722a95",
                "fromPlaceId": "903ef473-23a2-4114-baf2-d6e51b6a817f",
                "toPlaceId": "0b1c1c57-b1c0-4eae-bf6a-028844cb5bef",
                "mode": "straight",
                "order": 1
              }
            ],
            "layerItems": [
              {
                "type": "place",
                "id": "903ef473-23a2-4114-baf2-d6e51b6a817f"
              },
              {
                "type": "polyline",
                "id": "1ba3a62e-7319-43d6-9398-885414722a95"
              },
              {
                "type": "place",
                "id": "0b1c1c57-b1c0-4eae-bf6a-028844cb5bef"
              }
            ]
          },
          {
            "id": "94478890-9aa6-43f9-b6b5-6b5dac4d5e8f",
            "title": "2일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "833dae37-39d6-47d7-9280-c7a475ac1f87",
                "placeId": "fixture-place-tower",
                "name": "도쿄 타워",
                "location": {
                  "lat": 35.6586,
                  "lng": 139.7454
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              }
            ],
            "polylines": [],
            "layerItems": [
              {
                "type": "place",
                "id": "833dae37-39d6-47d7-9280-c7a475ac1f87"
              }
            ]
          }
        ],
        "createdAt": "2026-10-05T08:03:20.921Z",
        "updatedAt": "2026-10-05T08:03:20.921Z"
      },
      "provider": "openwebui",
      "model": "qwen3.5:9b",
      "rawOutput": null,
      "commandSequence": [],
      "validation": "NOT_RUN",
      "preview": null,
      "execution": "NOT_RUN",
      "save": "NOT_RUN",
      "reload": "NOT_RUN",
      "after": null,
      "intentMatch": "NOT_RUN",
      "errorsFixes": [
        "PROVIDER_FAILURE: 답변을 불러올 수 없습니다. 잠시 후 다시 시도해 주세요."
      ],
      "latency": {
        "modelRequestMs": null,
        "prepareMs": null,
        "executeMs": null,
        "saveMs": null,
        "reloadMs": null,
        "totalMs": 120163.70000004768
      },
      "status": "FAIL"
    },
    {
      "scenarioId": "T3-S10",
      "request": "1일차의 시부야 방문 시작 시간을 오후 2시로 바꿔줘.",
      "before": {
        "id": "df933120-ceae-42e7-ac21-2b0c0eeb838f",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "1c92d1c8-82ba-4d42-8c1a-ab96ca6c05d6",
            "title": "1일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "1038c827-570b-49ed-bff1-e6c8c2d55065",
                "placeId": "fixture-place-shibuya",
                "name": "시부야",
                "location": {
                  "lat": 35.6595,
                  "lng": 139.7005
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              },
              {
                "id": "9f04a103-1e75-432e-922c-515a01413586",
                "placeId": "fixture-place-ueno",
                "name": "우에노 공원",
                "location": {
                  "lat": 35.7148,
                  "lng": 139.7732
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 2
              }
            ],
            "polylines": [
              {
                "id": "74abcef7-4a10-4a3b-b53a-24446f253190",
                "fromPlaceId": "1038c827-570b-49ed-bff1-e6c8c2d55065",
                "toPlaceId": "9f04a103-1e75-432e-922c-515a01413586",
                "mode": "straight",
                "order": 1
              }
            ],
            "layerItems": [
              {
                "type": "place",
                "id": "1038c827-570b-49ed-bff1-e6c8c2d55065"
              },
              {
                "type": "polyline",
                "id": "74abcef7-4a10-4a3b-b53a-24446f253190"
              },
              {
                "type": "place",
                "id": "9f04a103-1e75-432e-922c-515a01413586"
              }
            ]
          },
          {
            "id": "6ad566e3-4f1d-487a-a879-d7f7fc142f49",
            "title": "2일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "bd828ae3-8ac7-4682-9017-d0739f17abe1",
                "placeId": "fixture-place-tower",
                "name": "도쿄 타워",
                "location": {
                  "lat": 35.6586,
                  "lng": 139.7454
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              }
            ],
            "polylines": [],
            "layerItems": [
              {
                "type": "place",
                "id": "bd828ae3-8ac7-4682-9017-d0739f17abe1"
              }
            ]
          }
        ],
        "createdAt": "2026-10-05T08:05:21.090Z",
        "updatedAt": "2026-10-05T08:05:21.090Z"
      },
      "provider": "openwebui",
      "model": "qwen3.5:9b",
      "rawOutput": null,
      "commandSequence": [],
      "validation": "NOT_RUN",
      "preview": null,
      "execution": "NOT_RUN",
      "save": "NOT_RUN",
      "reload": "NOT_RUN",
      "after": null,
      "intentMatch": "NOT_RUN",
      "errorsFixes": [
        "PROVIDER_FAILURE: 답변을 불러올 수 없습니다. 잠시 후 다시 시도해 주세요."
      ],
      "latency": {
        "modelRequestMs": null,
        "prepareMs": null,
        "executeMs": null,
        "saveMs": null,
        "reloadMs": null,
        "totalMs": 120203
      },
      "status": "FAIL"
    },
    {
      "scenarioId": "T3-S11",
      "request": "1일차의 시부야 방문 시간을 90분으로 바꿔줘.",
      "before": {
        "id": "a662a1a8-058f-496e-a2e8-c8656ea8e470",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "3e77a507-db16-40bf-9c9f-3b4e72dc540b",
            "title": "1일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "dbf6d91c-6ba6-4159-b872-6b52416cfe11",
                "placeId": "fixture-place-shibuya",
                "name": "시부야",
                "location": {
                  "lat": 35.6595,
                  "lng": 139.7005
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              },
              {
                "id": "73959da4-7e21-48d1-8681-8832eafcf19a",
                "placeId": "fixture-place-ueno",
                "name": "우에노 공원",
                "location": {
                  "lat": 35.7148,
                  "lng": 139.7732
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 2
              }
            ],
            "polylines": [
              {
                "id": "2a2ffaec-1191-4186-9650-9a33f20ee18b",
                "fromPlaceId": "dbf6d91c-6ba6-4159-b872-6b52416cfe11",
                "toPlaceId": "73959da4-7e21-48d1-8681-8832eafcf19a",
                "mode": "straight",
                "order": 1
              }
            ],
            "layerItems": [
              {
                "type": "place",
                "id": "dbf6d91c-6ba6-4159-b872-6b52416cfe11"
              },
              {
                "type": "polyline",
                "id": "2a2ffaec-1191-4186-9650-9a33f20ee18b"
              },
              {
                "type": "place",
                "id": "73959da4-7e21-48d1-8681-8832eafcf19a"
              }
            ]
          },
          {
            "id": "fbb6de92-b230-47fe-bc13-f5d241da49f8",
            "title": "2일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "405ec4ad-fbd8-4d45-9874-893e5a196e00",
                "placeId": "fixture-place-tower",
                "name": "도쿄 타워",
                "location": {
                  "lat": 35.6586,
                  "lng": 139.7454
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              }
            ],
            "polylines": [],
            "layerItems": [
              {
                "type": "place",
                "id": "405ec4ad-fbd8-4d45-9874-893e5a196e00"
              }
            ]
          }
        ],
        "createdAt": "2026-10-05T08:07:21.306Z",
        "updatedAt": "2026-10-05T08:07:21.306Z"
      },
      "provider": "openwebui",
      "model": "qwen3.5:9b",
      "rawOutput": null,
      "commandSequence": [],
      "validation": "NOT_RUN",
      "preview": null,
      "execution": "NOT_RUN",
      "save": "NOT_RUN",
      "reload": "NOT_RUN",
      "after": null,
      "intentMatch": "NOT_RUN",
      "errorsFixes": [
        "PROVIDER_FAILURE: 답변을 불러올 수 없습니다. 잠시 후 다시 시도해 주세요."
      ],
      "latency": {
        "modelRequestMs": null,
        "prepareMs": null,
        "executeMs": null,
        "saveMs": null,
        "reloadMs": null,
        "totalMs": 120176.70000004768
      },
      "status": "FAIL"
    },
    {
      "scenarioId": "T3-S12",
      "request": "1일차의 시부야 선호 체류 시간을 120분으로 바꿔줘.",
      "before": {
        "id": "8eb7d85e-63a9-446c-bfd9-4e9bcbc6d36a",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "72584a00-e81d-40fd-8a47-0224dab176f9",
            "title": "1일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "7c30bbcf-6587-48f1-8faf-8d4603090f29",
                "placeId": "fixture-place-shibuya",
                "name": "시부야",
                "location": {
                  "lat": 35.6595,
                  "lng": 139.7005
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              },
              {
                "id": "4595b8b9-7d2a-4c40-876f-7bc220c46cb6",
                "placeId": "fixture-place-ueno",
                "name": "우에노 공원",
                "location": {
                  "lat": 35.7148,
                  "lng": 139.7732
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 2
              }
            ],
            "polylines": [
              {
                "id": "02e62ec7-7ce3-4e66-b050-31e110aedd3f",
                "fromPlaceId": "7c30bbcf-6587-48f1-8faf-8d4603090f29",
                "toPlaceId": "4595b8b9-7d2a-4c40-876f-7bc220c46cb6",
                "mode": "straight",
                "order": 1
              }
            ],
            "layerItems": [
              {
                "type": "place",
                "id": "7c30bbcf-6587-48f1-8faf-8d4603090f29"
              },
              {
                "type": "polyline",
                "id": "02e62ec7-7ce3-4e66-b050-31e110aedd3f"
              },
              {
                "type": "place",
                "id": "4595b8b9-7d2a-4c40-876f-7bc220c46cb6"
              }
            ]
          },
          {
            "id": "915d1d1a-c619-48e2-b95a-5fb4389014de",
            "title": "2일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "2e178552-67a8-4da6-a069-1b5463f16597",
                "placeId": "fixture-place-tower",
                "name": "도쿄 타워",
                "location": {
                  "lat": 35.6586,
                  "lng": 139.7454
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              }
            ],
            "polylines": [],
            "layerItems": [
              {
                "type": "place",
                "id": "2e178552-67a8-4da6-a069-1b5463f16597"
              }
            ]
          }
        ],
        "createdAt": "2026-10-05T08:09:21.481Z",
        "updatedAt": "2026-10-05T08:09:21.481Z"
      },
      "provider": "openwebui",
      "model": "qwen3.5:9b",
      "rawOutput": null,
      "commandSequence": [],
      "validation": "NOT_RUN",
      "preview": null,
      "execution": "NOT_RUN",
      "save": "NOT_RUN",
      "reload": "NOT_RUN",
      "after": null,
      "intentMatch": "NOT_RUN",
      "errorsFixes": [
        "PROVIDER_FAILURE: 답변을 불러올 수 없습니다. 잠시 후 다시 시도해 주세요."
      ],
      "latency": {
        "modelRequestMs": null,
        "prepareMs": null,
        "executeMs": null,
        "saveMs": null,
        "reloadMs": null,
        "totalMs": 120218.80000007153
      },
      "status": "FAIL"
    },
    {
      "scenarioId": "T3-S13",
      "request": "1일차의 시부야에서 도쿄 타워로 이어지는 경로를 도보 모드로 바꿔줘.",
      "before": {
        "id": "ba7f4a27-db92-4b2f-81bb-e6a60ede90bb",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "10d62102-d846-42e6-a583-bbb077f78595",
            "title": "1일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "f2cefbbe-db09-46fe-966f-c289ad17fa86",
                "placeId": "fixture-place-shibuya",
                "name": "시부야",
                "location": {
                  "lat": 35.6595,
                  "lng": 139.7005
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              },
              {
                "id": "b2a564ae-1486-40a8-90d8-8c862895836b",
                "placeId": "fixture-place-tower",
                "name": "도쿄 타워",
                "location": {
                  "lat": 35.6586,
                  "lng": 139.7454
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 2
              }
            ],
            "polylines": [
              {
                "id": "807aeeef-6b30-4a5a-bbec-cdf22e50eb99",
                "fromPlaceId": "f2cefbbe-db09-46fe-966f-c289ad17fa86",
                "toPlaceId": "b2a564ae-1486-40a8-90d8-8c862895836b",
                "mode": "straight",
                "order": 1
              }
            ],
            "layerItems": [
              {
                "type": "place",
                "id": "f2cefbbe-db09-46fe-966f-c289ad17fa86"
              },
              {
                "type": "polyline",
                "id": "807aeeef-6b30-4a5a-bbec-cdf22e50eb99"
              },
              {
                "type": "place",
                "id": "b2a564ae-1486-40a8-90d8-8c862895836b"
              }
            ]
          }
        ],
        "createdAt": "2026-10-05T08:11:21.711Z",
        "updatedAt": "2026-10-05T08:11:21.711Z"
      },
      "provider": "openwebui",
      "model": "qwen3.5:9b",
      "rawOutput": null,
      "commandSequence": [],
      "validation": "NOT_RUN",
      "preview": null,
      "execution": "NOT_RUN",
      "save": "NOT_RUN",
      "reload": "NOT_RUN",
      "after": null,
      "intentMatch": "NOT_RUN",
      "errorsFixes": [
        "PROVIDER_FAILURE: 답변을 불러올 수 없습니다. 잠시 후 다시 시도해 주세요."
      ],
      "latency": {
        "modelRequestMs": null,
        "prepareMs": null,
        "executeMs": null,
        "saveMs": null,
        "reloadMs": null,
        "totalMs": 120403.39999997616
      },
      "status": "FAIL"
    },
    {
      "scenarioId": "T3-C2",
      "request": "시부야를 1일차에서 2일차 마지막으로 옮기고 메모에 야경이라고 적어줘.",
      "before": {
        "id": "013c11ae-eeeb-45d7-90c4-611266e5705c",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "ff82aec8-0b34-41fb-ac00-0e25bdea27af",
            "title": "1일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "e15296a1-5aac-4d6e-949f-66c57dec0419",
                "placeId": "fixture-place-shibuya",
                "name": "시부야",
                "location": {
                  "lat": 35.6595,
                  "lng": 139.7005
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              },
              {
                "id": "c5e130ec-f49b-4de5-b71a-4b3f85f06dde",
                "placeId": "fixture-place-ueno",
                "name": "우에노 공원",
                "location": {
                  "lat": 35.7148,
                  "lng": 139.7732
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 2
              }
            ],
            "polylines": [
              {
                "id": "71ffebcf-dfae-4eda-87ae-5b40ad98af49",
                "fromPlaceId": "e15296a1-5aac-4d6e-949f-66c57dec0419",
                "toPlaceId": "c5e130ec-f49b-4de5-b71a-4b3f85f06dde",
                "mode": "straight",
                "order": 1
              }
            ],
            "layerItems": [
              {
                "type": "place",
                "id": "e15296a1-5aac-4d6e-949f-66c57dec0419"
              },
              {
                "type": "polyline",
                "id": "71ffebcf-dfae-4eda-87ae-5b40ad98af49"
              },
              {
                "type": "place",
                "id": "c5e130ec-f49b-4de5-b71a-4b3f85f06dde"
              }
            ]
          },
          {
            "id": "f78a7a4a-7d7c-43c4-9f6d-5969d86507a5",
            "title": "2일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "8b450b67-923c-4023-b5dc-4be12a7236c6",
                "placeId": "fixture-place-tower",
                "name": "도쿄 타워",
                "location": {
                  "lat": 35.6586,
                  "lng": 139.7454
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              }
            ],
            "polylines": [],
            "layerItems": [
              {
                "type": "place",
                "id": "8b450b67-923c-4023-b5dc-4be12a7236c6"
              }
            ]
          }
        ],
        "createdAt": "2026-10-05T08:13:22.126Z",
        "updatedAt": "2026-10-05T08:13:22.126Z"
      },
      "provider": "openwebui",
      "model": "qwen3.5:9b",
      "rawOutput": null,
      "commandSequence": [],
      "validation": "NOT_RUN",
      "preview": null,
      "execution": "NOT_RUN",
      "save": "NOT_RUN",
      "reload": "NOT_RUN",
      "after": null,
      "intentMatch": "NOT_RUN",
      "errorsFixes": [
        "PROVIDER_FAILURE: 답변을 불러올 수 없습니다. 잠시 후 다시 시도해 주세요."
      ],
      "latency": {
        "modelRequestMs": null,
        "prepareMs": null,
        "executeMs": null,
        "saveMs": null,
        "reloadMs": null,
        "totalMs": 120475.20000004768
      },
      "status": "FAIL"
    },
    {
      "scenarioId": "T3-C3",
      "request": "3일차를 새로 만들고 이 장소 세 개를 그쪽으로 옮겨줘.",
      "before": {
        "id": "1038048e-d3ae-4163-bbc6-f782ef413a44",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "b5b11412-15d3-4ba5-a25b-c78d819decd9",
            "title": "1일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "a2db3fa7-f81c-4bc6-b2bc-a7255498fe27",
                "placeId": "fixture-place-shibuya",
                "name": "시부야",
                "location": {
                  "lat": 35.6595,
                  "lng": 139.7005
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              },
              {
                "id": "67a78f76-82e6-4487-b0a8-d882ddbb2c88",
                "placeId": "fixture-place-ueno",
                "name": "우에노 공원",
                "location": {
                  "lat": 35.7148,
                  "lng": 139.7732
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 2
              },
              {
                "id": "55f60c0d-e191-42b5-9941-e2ae1161a5dd",
                "placeId": "fixture-place-tower",
                "name": "도쿄 타워",
                "location": {
                  "lat": 35.6586,
                  "lng": 139.7454
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 3
              }
            ],
            "polylines": [
              {
                "id": "6e77a87e-f48b-4d23-b279-17fa9ee293b3",
                "fromPlaceId": "a2db3fa7-f81c-4bc6-b2bc-a7255498fe27",
                "toPlaceId": "67a78f76-82e6-4487-b0a8-d882ddbb2c88",
                "mode": "straight",
                "order": 1
              },
              {
                "id": "5306ffd3-68d6-4bab-9e06-9070bb0d7032",
                "fromPlaceId": "67a78f76-82e6-4487-b0a8-d882ddbb2c88",
                "toPlaceId": "55f60c0d-e191-42b5-9941-e2ae1161a5dd",
                "mode": "straight",
                "order": 2
              }
            ],
            "layerItems": [
              {
                "type": "place",
                "id": "a2db3fa7-f81c-4bc6-b2bc-a7255498fe27"
              },
              {
                "type": "polyline",
                "id": "6e77a87e-f48b-4d23-b279-17fa9ee293b3"
              },
              {
                "type": "place",
                "id": "67a78f76-82e6-4487-b0a8-d882ddbb2c88"
              },
              {
                "type": "polyline",
                "id": "5306ffd3-68d6-4bab-9e06-9070bb0d7032"
              },
              {
                "type": "place",
                "id": "55f60c0d-e191-42b5-9941-e2ae1161a5dd"
              }
            ]
          },
          {
            "id": "7dc0b1fa-481f-43d5-87e6-e69151995652",
            "title": "2일차",
            "color": "#2563eb",
            "places": [],
            "polylines": [],
            "layerItems": []
          }
        ],
        "createdAt": "2026-10-05T08:15:22.623Z",
        "updatedAt": "2026-10-05T08:15:22.623Z"
      },
      "provider": "openwebui",
      "model": "qwen3.5:9b",
      "rawOutput": null,
      "commandSequence": [],
      "validation": "NOT_RUN",
      "preview": null,
      "execution": "NOT_RUN",
      "save": "NOT_RUN",
      "reload": "NOT_RUN",
      "after": null,
      "intentMatch": "NOT_RUN",
      "errorsFixes": [
        "PROVIDER_FAILURE: 답변을 불러올 수 없습니다. 잠시 후 다시 시도해 주세요."
      ],
      "latency": {
        "modelRequestMs": null,
        "prepareMs": null,
        "executeMs": null,
        "saveMs": null,
        "reloadMs": null,
        "totalMs": 120627.29999995232
      },
      "status": "FAIL"
    }
  ]
}
````

## docs/trip-command-t3-evidence.json

SHA256: `37b88f49bddc8c12739f0235782ecf68e93cae4d241d9a9968906a7db0cc8ec7`; bytes: 116539.

| ID | 원 요청 | 과거 상태 | 오류/수정 |
| --- | --- | --- | --- |
| T3-S05 | 2일차에 아사쿠사를 추가해줘. | BLOCKED | EXTERNAL_PLACE_SOURCE_BLOCKED: GOOGLE_PLACES_API_KEY is missing. |
| T3-C1 | 2일차에 아사쿠사를 추가하고 오후 2시부터 90분 머물게 해줘. | BLOCKED | EXTERNAL_PLACE_SOURCE_BLOCKED: GOOGLE_PLACES_API_KEY is missing. |
| T3-S01 | 여행 이름을 T3 검증 여행 완료로 바꿔줘. | PASS |  |
| T3-S02 | 새로운 3일차를 추가해줘. | PASS |  |
| T3-S03 | 2일차 이름을 둘째 날로 바꿔줘. | PASS |  |
| T3-S04 | 3일차를 맨 앞으로 옮겨줘. | PASS |  |
| T3-S06 | 1일차의 우에노 공원을 삭제해줘. | PASS |  |
| T3-S07 | 1일차의 시부야를 2일차 마지막으로 옮겨줘. | FAIL | MODEL_GENERATION_FAILURE: Expected operations move_place but received move_day. |
| T3-S08 | 1일차의 시부야 이름을 시부야 스카이로 바꿔줘. | PASS |  |
| T3-S09 | 1일차의 시부야 메모를 야경으로 설정해줘. | PASS |  |
| T3-S10 | 1일차의 시부야 방문 시작 시간을 오후 2시로 바꿔줘. | PASS |  |
| T3-S11 | 1일차의 시부야 방문 시간을 90분으로 바꿔줘. | FAIL | PARSER_SCHEMA_FAILURE: schema_invalid: MODEL_RESPONSE_FAILED_TRIP_COMMAND_PLAN_SCHEMA |
| T3-S12 | 1일차의 시부야 선호 체류 시간을 120분으로 바꿔줘. | PASS |  |
| T3-S13 | 1일차의 시부야에서 도쿄 타워로 이어지는 경로를 도보 모드로 바꿔줘. | PASS |  |
| T3-C2 | 시부야를 1일차에서 2일차 마지막으로 옮기고 메모에 야경이라고 적어줘. | FAIL | PARSER_SCHEMA_FAILURE: json_parse: MODEL_RESPONSE_IS_NOT_ONE_JSON_DOCUMENT |
| T3-C3 | 3일차를 새로 만들고 이 장소 세 개를 그쪽으로 옮겨줘. | FAIL | PARSER_SCHEMA_FAILURE: json_parse: MODEL_RESPONSE_FORMAT_IS_NOT_RAW_JSON_OR_JSON_FENCE |

````json
{
  "contractVersion": "trip-command-plan/v1",
  "startedAt": "2026-10-05T07:00:15.846Z",
  "completedAt": "2026-10-05T07:04:42.852Z",
  "records": [
    {
      "scenarioId": "T3-S05",
      "request": "2일차에 아사쿠사를 추가해줘.",
      "before": null,
      "provider": "openwebui",
      "model": "qwen3.5:2b",
      "rawOutput": null,
      "commandSequence": [],
      "validation": "NOT_RUN",
      "preview": null,
      "execution": "NOT_RUN",
      "save": "NOT_RUN",
      "reload": "NOT_RUN",
      "after": null,
      "intentMatch": "NOT_RUN",
      "errorsFixes": [
        "EXTERNAL_PLACE_SOURCE_BLOCKED: GOOGLE_PLACES_API_KEY is missing."
      ],
      "latency": {
        "modelRequestMs": null,
        "prepareMs": null,
        "executeMs": null,
        "saveMs": null,
        "reloadMs": null,
        "totalMs": 0
      },
      "status": "BLOCKED"
    },
    {
      "scenarioId": "T3-C1",
      "request": "2일차에 아사쿠사를 추가하고 오후 2시부터 90분 머물게 해줘.",
      "before": null,
      "provider": "openwebui",
      "model": "qwen3.5:2b",
      "rawOutput": null,
      "commandSequence": [],
      "validation": "NOT_RUN",
      "preview": null,
      "execution": "NOT_RUN",
      "save": "NOT_RUN",
      "reload": "NOT_RUN",
      "after": null,
      "intentMatch": "NOT_RUN",
      "errorsFixes": [
        "EXTERNAL_PLACE_SOURCE_BLOCKED: GOOGLE_PLACES_API_KEY is missing."
      ],
      "latency": {
        "modelRequestMs": null,
        "prepareMs": null,
        "executeMs": null,
        "saveMs": null,
        "reloadMs": null,
        "totalMs": 0
      },
      "status": "BLOCKED"
    },
    {
      "scenarioId": "T3-S01",
      "request": "여행 이름을 T3 검증 여행 완료로 바꿔줘.",
      "before": {
        "id": "4d41988b-fb00-4a70-986e-f2579cafa4c0",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [],
        "createdAt": "2026-10-05T07:00:15.881Z",
        "updatedAt": "2026-10-05T07:00:15.881Z"
      },
      "provider": "openwebui",
      "model": "qwen3.5:2b",
      "rawOutput": "```json\n{\n  \"version\": 1,\n  \"base\": {\n    \"tripId\": \"4d41988b-fb00-4a70-986e-f2579cafa4c0\",\n    \"fingerprint\": \"sha256:5ee245a4fde32739636a591e33e41bf9991996ce8cac09252dd0bbe1e9b77851\"\n  },\n  \"operations\": [\n    {\n      \"stepId\": \"s1\",\n      \"op\": \"rename_trip\",\n      \"title\": \"T3 검증 여행 완료\"\n    }\n  ]\n}\n```",
      "commandSequence": [
        {
          "stepId": "s1",
          "op": "rename_trip",
          "title": "T3 검증 여행 완료"
        }
      ],
      "validation": "PASS",
      "preview": {
        "operationCount": 1,
        "commandCount": 2,
        "diff": [
          {
            "op": "rename_trip",
            "before": "T3 Validation Trip",
            "after": "T3 검증 여행 완료"
          }
        ],
        "risk": {
          "characteristics": ["metadata_edit"]
        },
        "before": {
          "id": "4d41988b-fb00-4a70-986e-f2579cafa4c0",
          "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
          "title": "T3 Validation Trip",
          "days": [],
          "createdAt": "2026-10-05T07:00:15.881Z",
          "updatedAt": "2026-10-05T07:00:15.881Z"
        },
        "after": {
          "id": "4d41988b-fb00-4a70-986e-f2579cafa4c0",
          "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
          "title": "T3 검증 여행 완료",
          "days": [],
          "createdAt": "2026-10-05T07:00:15.881Z",
          "updatedAt": "2026-10-05T07:00:15.881Z"
        }
      },
      "execution": "PASS",
      "save": "PASS",
      "reload": "PASS",
      "after": {
        "id": "4d41988b-fb00-4a70-986e-f2579cafa4c0",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 검증 여행 완료",
        "days": [],
        "createdAt": "2026-10-05T07:00:15.881Z",
        "updatedAt": "2026-10-05T07:00:25.750Z"
      },
      "intentMatch": "PASS",
      "errorsFixes": [],
      "latency": {
        "modelRequestMs": 9822,
        "prepareMs": 1.600000023841858,
        "executeMs": 0.6000000238418579,
        "saveMs": 19.600000023841858,
        "reloadMs": 4.299999952316284,
        "totalMs": 9918.700000047684
      },
      "status": "PASS"
    },
    {
      "scenarioId": "T3-S02",
      "request": "새로운 3일차를 추가해줘.",
      "before": {
        "id": "61947318-f94a-4f46-8ec0-aac27169d4fb",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "037c3c03-d160-4810-a755-c3dab464a9bd",
            "title": "1일차",
            "color": "#2563eb",
            "places": [],
            "polylines": [],
            "layerItems": []
          },
          {
            "id": "dd37319f-dbbb-4cdb-b80d-70806bf6ee4a",
            "title": "2일차",
            "color": "#2563eb",
            "places": [],
            "polylines": [],
            "layerItems": []
          }
        ],
        "createdAt": "2026-10-05T07:04:36.810Z",
        "updatedAt": "2026-10-05T07:04:36.810Z"
      },
      "provider": "openwebui",
      "model": "qwen3.5:2b",
      "rawOutput": "{\"version\":1,\"base\":{\"tripId\":\"61947318-f94a-4f46-8ec0-aac27169d4fb\",\"fingerprint\":\"sha256:6e82013e382eb5230764822973f2a7bfaa6d3fc2be0c4fe650bbd75021029285\"},\"operations\":[{\"stepId\":\"s1\",\"op\":\"add_day\",\"title\":\"새로운 3일차 추가\"}]}",
      "commandSequence": [
        {
          "stepId": "s1",
          "op": "add_day",
          "title": "새로운 3일차 추가"
        }
      ],
      "validation": "PASS",
      "preview": {
        "operationCount": 1,
        "commandCount": 2,
        "diff": [
          {
            "op": "add_day",
            "dayId": "pending-923073af-9853-469c-8c3a-4439566eaf27",
            "title": "새로운 3일차 추가",
            "index": 2
          }
        ],
        "risk": {
          "characteristics": ["structural_change"]
        },
        "before": {
          "id": "61947318-f94a-4f46-8ec0-aac27169d4fb",
          "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
          "title": "T3 Validation Trip",
          "days": [
            {
              "id": "037c3c03-d160-4810-a755-c3dab464a9bd",
              "title": "1일차",
              "color": "#2563eb",
              "places": [],
              "polylines": [],
              "layerItems": []
            },
            {
              "id": "dd37319f-dbbb-4cdb-b80d-70806bf6ee4a",
              "title": "2일차",
              "color": "#2563eb",
              "places": [],
              "polylines": [],
              "layerItems": []
            }
          ],
          "createdAt": "2026-10-05T07:04:36.810Z",
          "updatedAt": "2026-10-05T07:04:36.810Z"
        },
        "after": {
          "id": "61947318-f94a-4f46-8ec0-aac27169d4fb",
          "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
          "title": "T3 Validation Trip",
          "days": [
            {
              "id": "037c3c03-d160-4810-a755-c3dab464a9bd",
              "title": "1일차",
              "color": "#2563eb",
              "places": [],
              "polylines": [],
              "layerItems": []
            },
            {
              "id": "dd37319f-dbbb-4cdb-b80d-70806bf6ee4a",
              "title": "2일차",
              "color": "#2563eb",
              "places": [],
              "polylines": [],
              "layerItems": []
            },
            {
              "id": "pending-923073af-9853-469c-8c3a-4439566eaf27",
              "title": "새로운 3일차 추가",
              "color": "#ca8a04",
              "places": [],
              "polylines": [],
              "layerItems": []
            }
          ],
          "createdAt": "2026-10-05T07:04:36.810Z",
          "updatedAt": "2026-10-05T07:04:36.810Z"
        }
      },
      "execution": "PASS",
      "save": "PASS",
      "reload": "PASS",
      "after": {
        "id": "61947318-f94a-4f46-8ec0-aac27169d4fb",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "037c3c03-d160-4810-a755-c3dab464a9bd",
            "title": "1일차",
            "color": "#2563eb",
            "places": [],
            "polylines": [],
            "layerItems": []
          },
          {
            "id": "dd37319f-dbbb-4cdb-b80d-70806bf6ee4a",
            "title": "2일차",
            "color": "#2563eb",
            "places": [],
            "polylines": [],
            "layerItems": []
          },
          {
            "id": "b6d529cb-ce5c-4af4-bc6a-61b467b61e78",
            "title": "새로운 3일차 추가",
            "color": "#ea580c",
            "places": [],
            "polylines": [],
            "layerItems": []
          }
        ],
        "createdAt": "2026-10-05T07:04:36.810Z",
        "updatedAt": "2026-10-05T07:04:42.839Z"
      },
      "intentMatch": "PASS",
      "errorsFixes": [],
      "latency": {
        "modelRequestMs": 5981.899999976158,
        "prepareMs": 1.3000000715255737,
        "executeMs": 1.2999999523162842,
        "saveMs": 10.5,
        "reloadMs": 1.8000000715255737,
        "totalMs": 6060.700000047684
      },
      "status": "PASS"
    },
    {
      "scenarioId": "T3-S03",
      "request": "2일차 이름을 둘째 날로 바꿔줘.",
      "before": {
        "id": "74477db0-88c9-4eb9-91dd-82b801a388cb",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "e2bf2e51-de3c-4a80-82ef-6c1e8b195d1e",
            "title": "1일차",
            "color": "#2563eb",
            "places": [],
            "polylines": [],
            "layerItems": []
          },
          {
            "id": "b51ce4d9-d5ad-44a6-9c67-efd6b6805f4b",
            "title": "2일차",
            "color": "#2563eb",
            "places": [],
            "polylines": [],
            "layerItems": []
          }
        ],
        "createdAt": "2026-10-05T07:00:31.581Z",
        "updatedAt": "2026-10-05T07:00:31.581Z"
      },
      "provider": "openwebui",
      "model": "qwen3.5:2b",
      "rawOutput": "{\"version\":1,\"base\":{\"tripId\":\"74477db0-88c9-4eb9-91dd-82b801a388cb\",\"fingerprint\":\"sha256:3c2e94f39a0979318a5c5483a3170fc1bff5f40f29455ad1c0119dd82d6395e7\"},\"operations\":[{\"stepId\":\"s1\",\"op\":\"rename_day\",\"day\":{\"kind\":\"id\",\"id\":\"b51ce4d9-d5ad-44a6-9c67-efd6b6805f4b\"},\"title\":\"둘째 날\"}]}",
      "commandSequence": [
        {
          "stepId": "s1",
          "op": "rename_day",
          "day": {
            "kind": "id",
            "id": "b51ce4d9-d5ad-44a6-9c67-efd6b6805f4b"
          },
          "title": "둘째 날"
        }
      ],
      "validation": "PASS",
      "preview": {
        "operationCount": 1,
        "commandCount": 2,
        "diff": [
          {
            "op": "rename_day",
            "dayId": "b51ce4d9-d5ad-44a6-9c67-efd6b6805f4b",
            "before": "2일차",
            "after": "둘째 날"
          }
        ],
        "risk": {
          "characteristics": ["metadata_edit"]
        },
        "before": {
          "id": "74477db0-88c9-4eb9-91dd-82b801a388cb",
          "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
          "title": "T3 Validation Trip",
          "days": [
            {
              "id": "e2bf2e51-de3c-4a80-82ef-6c1e8b195d1e",
              "title": "1일차",
              "color": "#2563eb",
              "places": [],
              "polylines": [],
              "layerItems": []
            },
            {
              "id": "b51ce4d9-d5ad-44a6-9c67-efd6b6805f4b",
              "title": "2일차",
              "color": "#2563eb",
              "places": [],
              "polylines": [],
              "layerItems": []
            }
          ],
          "createdAt": "2026-10-05T07:00:31.581Z",
          "updatedAt": "2026-10-05T07:00:31.581Z"
        },
        "after": {
          "id": "74477db0-88c9-4eb9-91dd-82b801a388cb",
          "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
          "title": "T3 Validation Trip",
          "days": [
            {
              "id": "e2bf2e51-de3c-4a80-82ef-6c1e8b195d1e",
              "title": "1일차",
              "color": "#2563eb",
              "places": [],
              "polylines": [],
              "layerItems": []
            },
            {
              "id": "b51ce4d9-d5ad-44a6-9c67-efd6b6805f4b",
              "title": "둘째 날",
              "color": "#2563eb",
              "places": [],
              "polylines": [],
              "layerItems": []
            }
          ],
          "createdAt": "2026-10-05T07:00:31.581Z",
          "updatedAt": "2026-10-05T07:00:31.581Z"
        }
      },
      "execution": "PASS",
      "save": "PASS",
      "reload": "PASS",
      "after": {
        "id": "74477db0-88c9-4eb9-91dd-82b801a388cb",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "e2bf2e51-de3c-4a80-82ef-6c1e8b195d1e",
            "title": "1일차",
            "color": "#2563eb",
            "places": [],
            "polylines": [],
            "layerItems": []
          },
          {
            "id": "b51ce4d9-d5ad-44a6-9c67-efd6b6805f4b",
            "title": "둘째 날",
            "color": "#2563eb",
            "places": [],
            "polylines": [],
            "layerItems": []
          }
        ],
        "createdAt": "2026-10-05T07:00:31.581Z",
        "updatedAt": "2026-10-05T07:00:38.859Z"
      },
      "intentMatch": "PASS",
      "errorsFixes": [],
      "latency": {
        "modelRequestMs": 7238,
        "prepareMs": 1.100000023841858,
        "executeMs": 0.8000000715255737,
        "saveMs": 13.899999976158142,
        "reloadMs": 2,
        "totalMs": 7291.5
      },
      "status": "PASS"
    },
    {
      "scenarioId": "T3-S04",
      "request": "3일차를 맨 앞으로 옮겨줘.",
      "before": {
        "id": "53e73646-a47c-4044-b634-065ae97041d3",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "0ccce64a-e5b3-463e-a19f-f992011b1757",
            "title": "1일차",
            "color": "#2563eb",
            "places": [],
            "polylines": [],
            "layerItems": []
          },
          {
            "id": "d01cb4ef-959c-4d29-befe-1955bd360060",
            "title": "2일차",
            "color": "#2563eb",
            "places": [],
            "polylines": [],
            "layerItems": []
          },
          {
            "id": "ea7a77d7-7927-4943-b976-82d05050ca9b",
            "title": "3일차",
            "color": "#2563eb",
            "places": [],
            "polylines": [],
            "layerItems": []
          }
        ],
        "createdAt": "2026-10-05T07:00:38.873Z",
        "updatedAt": "2026-10-05T07:00:38.873Z"
      },
      "provider": "openwebui",
      "model": "qwen3.5:2b",
      "rawOutput": "{\"version\":1,\"base\":{\"tripId\":\"53e73646-a47c-4044-b634-065ae97041d3\",\"fingerprint\":\"sha256:9473ff903f8aefb5c31044bd93e85eafd0670ab306b36d53f378e1ae1a656263\"},\"operations\":[{\"stepId\":\"s1\",\"op\":\"move_day\",\"day\":{\"kind\":\"id\",\"id\":\"ea7a77d7-7927-4943-b976-82d05050ca9b\"},\"position\":{\"kind\":\"start\"}}]}",
      "commandSequence": [
        {
          "stepId": "s1",
          "op": "move_day",
          "day": {
            "kind": "id",
            "id": "ea7a77d7-7927-4943-b976-82d05050ca9b"
          },
          "position": {
            "kind": "start"
          }
        }
      ],
      "validation": "PASS",
      "preview": {
        "operationCount": 1,
        "commandCount": 2,
        "diff": [
          {
            "op": "move_day",
            "dayId": "ea7a77d7-7927-4943-b976-82d05050ca9b",
            "beforeIndex": 2,
            "afterIndex": 0
          },
          {
            "op": "move_day",
            "dayId": "0ccce64a-e5b3-463e-a19f-f992011b1757",
            "beforeIndex": 0,
            "afterIndex": 1
          },
          {
            "op": "move_day",
            "dayId": "d01cb4ef-959c-4d29-befe-1955bd360060",
            "beforeIndex": 1,
            "afterIndex": 2
          }
        ],
        "risk": {
          "characteristics": ["structural_change"]
        },
        "before": {
          "id": "53e73646-a47c-4044-b634-065ae97041d3",
          "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
          "title": "T3 Validation Trip",
          "days": [
            {
              "id": "0ccce64a-e5b3-463e-a19f-f992011b1757",
              "title": "1일차",
              "color": "#2563eb",
              "places": [],
              "polylines": [],
              "layerItems": []
            },
            {
              "id": "d01cb4ef-959c-4d29-befe-1955bd360060",
              "title": "2일차",
              "color": "#2563eb",
              "places": [],
              "polylines": [],
              "layerItems": []
            },
            {
              "id": "ea7a77d7-7927-4943-b976-82d05050ca9b",
              "title": "3일차",
              "color": "#2563eb",
              "places": [],
              "polylines": [],
              "layerItems": []
            }
          ],
          "createdAt": "2026-10-05T07:00:38.873Z",
          "updatedAt": "2026-10-05T07:00:38.873Z"
        },
        "after": {
          "id": "53e73646-a47c-4044-b634-065ae97041d3",
          "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
          "title": "T3 Validation Trip",
          "days": [
            {
              "id": "ea7a77d7-7927-4943-b976-82d05050ca9b",
              "title": "3일차",
              "color": "#2563eb",
              "places": [],
              "polylines": [],
              "layerItems": []
            },
            {
              "id": "0ccce64a-e5b3-463e-a19f-f992011b1757",
              "title": "1일차",
              "color": "#2563eb",
              "places": [],
              "polylines": [],
              "layerItems": []
            },
            {
              "id": "d01cb4ef-959c-4d29-befe-1955bd360060",
              "title": "2일차",
              "color": "#2563eb",
              "places": [],
              "polylines": [],
              "layerItems": []
            }
          ],
          "createdAt": "2026-10-05T07:00:38.873Z",
          "updatedAt": "2026-10-05T07:00:38.873Z"
        }
      },
      "execution": "PASS",
      "save": "PASS",
      "reload": "PASS",
      "after": {
        "id": "53e73646-a47c-4044-b634-065ae97041d3",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "ea7a77d7-7927-4943-b976-82d05050ca9b",
            "title": "3일차",
            "color": "#2563eb",
            "places": [],
            "polylines": [],
            "layerItems": []
          },
          {
            "id": "0ccce64a-e5b3-463e-a19f-f992011b1757",
            "title": "1일차",
            "color": "#2563eb",
            "places": [],
            "polylines": [],
            "layerItems": []
          },
          {
            "id": "d01cb4ef-959c-4d29-befe-1955bd360060",
            "title": "2일차",
            "color": "#2563eb",
            "places": [],
            "polylines": [],
            "layerItems": []
          }
        ],
        "createdAt": "2026-10-05T07:00:38.873Z",
        "updatedAt": "2026-10-05T07:00:45.891Z"
      },
      "intentMatch": "PASS",
      "errorsFixes": [],
      "latency": {
        "modelRequestMs": 6983.099999904633,
        "prepareMs": 1.899999976158142,
        "executeMs": 1.100000023841858,
        "saveMs": 10.099999904632568,
        "reloadMs": 1.8000000715255737,
        "totalMs": 7029
      },
      "status": "PASS"
    },
    {
      "scenarioId": "T3-S06",
      "request": "1일차의 우에노 공원을 삭제해줘.",
      "before": {
        "id": "a8b6461b-4821-4167-88a6-8744415cc43e",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "0d635d8c-53c2-4280-875a-070a741be866",
            "title": "1일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "7e67dfaa-28b9-4558-a54b-b7df684abe62",
                "placeId": "fixture-place-shibuya",
                "name": "시부야",
                "location": {
                  "lat": 35.6595,
                  "lng": 139.7005
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              },
              {
                "id": "9321729f-5419-4c81-bfaa-1e75d49f3454",
                "placeId": "fixture-place-ueno",
                "name": "우에노 공원",
                "location": {
                  "lat": 35.7148,
                  "lng": 139.7732
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 2
              }
            ],
            "polylines": [
              {
                "id": "cfa81d71-6d7f-45bd-802e-616ebef2ab13",
                "fromPlaceId": "7e67dfaa-28b9-4558-a54b-b7df684abe62",
                "toPlaceId": "9321729f-5419-4c81-bfaa-1e75d49f3454",
                "mode": "straight",
                "order": 1
              }
            ],
            "layerItems": [
              {
                "type": "place",
                "id": "7e67dfaa-28b9-4558-a54b-b7df684abe62"
              },
              {
                "type": "polyline",
                "id": "cfa81d71-6d7f-45bd-802e-616ebef2ab13"
              },
              {
                "type": "place",
                "id": "9321729f-5419-4c81-bfaa-1e75d49f3454"
              }
            ]
          },
          {
            "id": "add4a57f-a30b-481c-9b72-92c727bc9bad",
            "title": "2일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "691c11b7-0976-46f7-8ac5-44e2733cee12",
                "placeId": "fixture-place-tower",
                "name": "도쿄 타워",
                "location": {
                  "lat": 35.6586,
                  "lng": 139.7454
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              }
            ],
            "polylines": [],
            "layerItems": [
              {
                "type": "place",
                "id": "691c11b7-0976-46f7-8ac5-44e2733cee12"
              }
            ]
          }
        ],
        "createdAt": "2026-10-05T07:00:45.903Z",
        "updatedAt": "2026-10-05T07:00:45.903Z"
      },
      "provider": "openwebui",
      "model": "qwen3.5:2b",
      "rawOutput": "{\"version\":1,\"base\":{\"tripId\":\"a8b6461b-4821-4167-88a6-8744415cc43e\",\"fingerprint\":\"sha256:01d42e0dc62860c0c7685517c0063c3b837a64fed8fdfea273ae1a7b42dea15c\"},\"operations\":[{\"stepId\":\"s1\",\"op\":\"remove_place\",\"place\":{\"kind\":\"id\",\"id\":\"9321729f-5419-4c81-bfaa-1e75d49f3454\"}}]}",
      "commandSequence": [
        {
          "stepId": "s1",
          "op": "remove_place",
          "place": {
            "kind": "id",
            "id": "9321729f-5419-4c81-bfaa-1e75d49f3454"
          }
        }
      ],
      "validation": "PASS",
      "preview": {
        "operationCount": 1,
        "commandCount": 2,
        "diff": [
          {
            "op": "remove_place",
            "placeId": "9321729f-5419-4c81-bfaa-1e75d49f3454",
            "dayId": "0d635d8c-53c2-4280-875a-070a741be866",
            "index": 1,
            "name": "우에노 공원"
          }
        ],
        "risk": {
          "characteristics": ["destructive_removal"]
        },
        "before": {
          "id": "a8b6461b-4821-4167-88a6-8744415cc43e",
          "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
          "title": "T3 Validation Trip",
          "days": [
            {
              "id": "0d635d8c-53c2-4280-875a-070a741be866",
              "title": "1일차",
              "color": "#2563eb",
              "places": [
                {
                  "id": "7e67dfaa-28b9-4558-a54b-b7df684abe62",
                  "placeId": "fixture-place-shibuya",
                  "name": "시부야",
                  "location": {
                    "lat": 35.6595,
                    "lng": 139.7005
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 1
                },
                {
                  "id": "9321729f-5419-4c81-bfaa-1e75d49f3454",
                  "placeId": "fixture-place-ueno",
                  "name": "우에노 공원",
                  "location": {
                    "lat": 35.7148,
                    "lng": 139.7732
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 2
                }
              ],
              "polylines": [
                {
                  "id": "cfa81d71-6d7f-45bd-802e-616ebef2ab13",
                  "fromPlaceId": "7e67dfaa-28b9-4558-a54b-b7df684abe62",
                  "toPlaceId": "9321729f-5419-4c81-bfaa-1e75d49f3454",
                  "mode": "straight",
                  "order": 1
                }
              ],
              "layerItems": [
                {
                  "type": "place",
                  "id": "7e67dfaa-28b9-4558-a54b-b7df684abe62"
                },
                {
                  "type": "polyline",
                  "id": "cfa81d71-6d7f-45bd-802e-616ebef2ab13"
                },
                {
                  "type": "place",
                  "id": "9321729f-5419-4c81-bfaa-1e75d49f3454"
                }
              ]
            },
            {
              "id": "add4a57f-a30b-481c-9b72-92c727bc9bad",
              "title": "2일차",
              "color": "#2563eb",
              "places": [
                {
                  "id": "691c11b7-0976-46f7-8ac5-44e2733cee12",
                  "placeId": "fixture-place-tower",
                  "name": "도쿄 타워",
                  "location": {
                    "lat": 35.6586,
                    "lng": 139.7454
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 1
                }
              ],
              "polylines": [],
              "layerItems": [
                {
                  "type": "place",
                  "id": "691c11b7-0976-46f7-8ac5-44e2733cee12"
                }
              ]
            }
          ],
          "createdAt": "2026-10-05T07:00:45.903Z",
          "updatedAt": "2026-10-05T07:00:45.903Z"
        },
        "after": {
          "id": "a8b6461b-4821-4167-88a6-8744415cc43e",
          "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
          "title": "T3 Validation Trip",
          "days": [
            {
              "id": "0d635d8c-53c2-4280-875a-070a741be866",
              "title": "1일차",
              "color": "#2563eb",
              "places": [
                {
                  "id": "7e67dfaa-28b9-4558-a54b-b7df684abe62",
                  "placeId": "fixture-place-shibuya",
                  "name": "시부야",
                  "location": {
                    "lat": 35.6595,
                    "lng": 139.7005
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 1
                }
              ],
              "polylines": [],
              "layerItems": [
                {
                  "type": "place",
                  "id": "7e67dfaa-28b9-4558-a54b-b7df684abe62"
                }
              ]
            },
            {
              "id": "add4a57f-a30b-481c-9b72-92c727bc9bad",
              "title": "2일차",
              "color": "#2563eb",
              "places": [
                {
                  "id": "691c11b7-0976-46f7-8ac5-44e2733cee12",
                  "placeId": "fixture-place-tower",
                  "name": "도쿄 타워",
                  "location": {
                    "lat": 35.6586,
                    "lng": 139.7454
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 1
                }
              ],
              "polylines": [],
              "layerItems": [
                {
                  "type": "place",
                  "id": "691c11b7-0976-46f7-8ac5-44e2733cee12"
                }
              ]
            }
          ],
          "createdAt": "2026-10-05T07:00:45.903Z",
          "updatedAt": "2026-10-05T07:00:45.903Z"
        }
      },
      "execution": "PASS",
      "save": "PASS",
      "reload": "PASS",
      "after": {
        "id": "a8b6461b-4821-4167-88a6-8744415cc43e",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "0d635d8c-53c2-4280-875a-070a741be866",
            "title": "1일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "7e67dfaa-28b9-4558-a54b-b7df684abe62",
                "placeId": "fixture-place-shibuya",
                "name": "시부야",
                "location": {
                  "lat": 35.6595,
                  "lng": 139.7005
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              }
            ],
            "polylines": [],
            "layerItems": [
              {
                "type": "place",
                "id": "7e67dfaa-28b9-4558-a54b-b7df684abe62"
              }
            ]
          },
          {
            "id": "add4a57f-a30b-481c-9b72-92c727bc9bad",
            "title": "2일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "691c11b7-0976-46f7-8ac5-44e2733cee12",
                "placeId": "fixture-place-tower",
                "name": "도쿄 타워",
                "location": {
                  "lat": 35.6586,
                  "lng": 139.7454
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              }
            ],
            "polylines": [],
            "layerItems": [
              {
                "type": "place",
                "id": "691c11b7-0976-46f7-8ac5-44e2733cee12"
              }
            ]
          }
        ],
        "createdAt": "2026-10-05T07:00:45.903Z",
        "updatedAt": "2026-10-05T07:00:53.379Z"
      },
      "intentMatch": "PASS",
      "errorsFixes": [],
      "latency": {
        "modelRequestMs": 7446.700000047684,
        "prepareMs": 0.8999999761581421,
        "executeMs": 0.40000009536743164,
        "saveMs": 17.90000009536743,
        "reloadMs": 2.6999999284744263,
        "totalMs": 7497.5
      },
      "status": "PASS"
    },
    {
      "scenarioId": "T3-S07",
      "request": "1일차의 시부야를 2일차 마지막으로 옮겨줘.",
      "before": {
        "id": "a7265e7d-e271-4728-bd11-52200633914c",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "332e3812-67c6-4b9a-972a-6ad151c1604c",
            "title": "1일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "09a04c28-c572-48a5-bbca-15126e7f084f",
                "placeId": "fixture-place-shibuya",
                "name": "시부야",
                "location": {
                  "lat": 35.6595,
                  "lng": 139.7005
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              },
              {
                "id": "21a66dcf-1f1c-4063-9d21-5a39f3a59684",
                "placeId": "fixture-place-ueno",
                "name": "우에노 공원",
                "location": {
                  "lat": 35.7148,
                  "lng": 139.7732
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 2
              }
            ],
            "polylines": [
              {
                "id": "7ba772be-cdb1-432f-8cad-202ebcd632d5",
                "fromPlaceId": "09a04c28-c572-48a5-bbca-15126e7f084f",
                "toPlaceId": "21a66dcf-1f1c-4063-9d21-5a39f3a59684",
                "mode": "straight",
                "order": 1
              }
            ],
            "layerItems": [
              {
                "type": "place",
                "id": "09a04c28-c572-48a5-bbca-15126e7f084f"
              },
              {
                "type": "polyline",
                "id": "7ba772be-cdb1-432f-8cad-202ebcd632d5"
              },
              {
                "type": "place",
                "id": "21a66dcf-1f1c-4063-9d21-5a39f3a59684"
              }
            ]
          },
          {
            "id": "333bc351-d3b2-415d-ad27-381e13353956",
            "title": "2일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "97254535-f9d7-4a5d-a756-bc979e51eb2b",
                "placeId": "fixture-place-tower",
                "name": "도쿄 타워",
                "location": {
                  "lat": 35.6586,
                  "lng": 139.7454
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              }
            ],
            "polylines": [],
            "layerItems": [
              {
                "type": "place",
                "id": "97254535-f9d7-4a5d-a756-bc979e51eb2b"
              }
            ]
          }
        ],
        "createdAt": "2026-10-05T07:00:53.400Z",
        "updatedAt": "2026-10-05T07:00:53.400Z"
      },
      "provider": "openwebui",
      "model": "qwen3.5:2b",
      "rawOutput": "{\"version\":1,\"base\":{\"tripId\":\"a7265e7d-e271-4728-bd11-52200633914c\",\"fingerprint\":\"sha256:075071dda8c81454d2d5634aadf2c302b6a9c0b59bffee3a9eff8b1b263f5de3\"},\"operations\":[{\"stepId\":\"s1\",\"op\":\"move_day\",\"day\":{\"kind\":\"id\",\"id\":\"333bc351-d3b2-415d-ad27-381e13353956\"},\"position\":{\"kind\":\"end\"}}]}",
      "commandSequence": [
        {
          "stepId": "s1",
          "op": "move_day",
          "day": {
            "kind": "id",
            "id": "333bc351-d3b2-415d-ad27-381e13353956"
          },
          "position": {
            "kind": "end"
          }
        }
      ],
      "validation": "NOT_RUN",
      "preview": null,
      "execution": "NOT_RUN",
      "save": "NOT_RUN",
      "reload": "NOT_RUN",
      "after": null,
      "intentMatch": "NOT_RUN",
      "errorsFixes": [
        "MODEL_GENERATION_FAILURE: Expected operations move_place but received move_day."
      ],
      "latency": {
        "modelRequestMs": 7854.899999976158,
        "prepareMs": null,
        "executeMs": null,
        "saveMs": null,
        "reloadMs": null,
        "totalMs": 7876
      },
      "status": "FAIL"
    },
    {
      "scenarioId": "T3-S08",
      "request": "1일차의 시부야 이름을 시부야 스카이로 바꿔줘.",
      "before": {
        "id": "58f03fa5-92db-40b1-a079-f5bee207168f",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "177d8f48-dca4-45bd-9e95-c713f53180b1",
            "title": "1일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "1ce589b3-eb83-461d-b672-0d3657fddc76",
                "placeId": "fixture-place-shibuya",
                "name": "시부야",
                "location": {
                  "lat": 35.6595,
                  "lng": 139.7005
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              },
              {
                "id": "57802cde-12b7-4eee-8a77-49c9082784f0",
                "placeId": "fixture-place-ueno",
                "name": "우에노 공원",
                "location": {
                  "lat": 35.7148,
                  "lng": 139.7732
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 2
              }
            ],
            "polylines": [
              {
                "id": "fa47903d-0fbd-426a-992b-04b92e6ea531",
                "fromPlaceId": "1ce589b3-eb83-461d-b672-0d3657fddc76",
                "toPlaceId": "57802cde-12b7-4eee-8a77-49c9082784f0",
                "mode": "straight",
                "order": 1
              }
            ],
            "layerItems": [
              {
                "type": "place",
                "id": "1ce589b3-eb83-461d-b672-0d3657fddc76"
              },
              {
                "type": "polyline",
                "id": "fa47903d-0fbd-426a-992b-04b92e6ea531"
              },
              {
                "type": "place",
                "id": "57802cde-12b7-4eee-8a77-49c9082784f0"
              }
            ]
          },
          {
            "id": "f672e76d-9428-4be3-836d-2c08443ebd9f",
            "title": "2일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "0a828c0d-b714-4e35-b980-2c9d185b7a6b",
                "placeId": "fixture-place-tower",
                "name": "도쿄 타워",
                "location": {
                  "lat": 35.6586,
                  "lng": 139.7454
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              }
            ],
            "polylines": [],
            "layerItems": [
              {
                "type": "place",
                "id": "0a828c0d-b714-4e35-b980-2c9d185b7a6b"
              }
            ]
          }
        ],
        "createdAt": "2026-10-05T07:01:01.280Z",
        "updatedAt": "2026-10-05T07:01:01.280Z"
      },
      "provider": "openwebui",
      "model": "qwen3.5:2b",
      "rawOutput": "{\"version\":1,\"base\":{\"tripId\":\"58f03fa5-92db-40b1-a079-f5bee207168f\",\"fingerprint\":\"sha256:4247ff44b5d1cbc67dfc75cd80a5081948f88fe817560525e0d2aa53401054be\"},\"operations\":[{\"stepId\":\"s1\",\"op\":\"rename_place\",\"place\":{\"kind\":\"id\",\"id\":\"1ce589b3-eb83-461d-b672-0d3657fddc76\"},\"name\":\"시부야 스카이\"}]}",
      "commandSequence": [
        {
          "stepId": "s1",
          "op": "rename_place",
          "place": {
            "kind": "id",
            "id": "1ce589b3-eb83-461d-b672-0d3657fddc76"
          },
          "name": "시부야 스카이"
        }
      ],
      "validation": "PASS",
      "preview": {
        "operationCount": 1,
        "commandCount": 2,
        "diff": [
          {
            "op": "rename_place",
            "placeId": "1ce589b3-eb83-461d-b672-0d3657fddc76",
            "before": "시부야",
            "after": "시부야 스카이"
          }
        ],
        "risk": {
          "characteristics": ["metadata_edit"]
        },
        "before": {
          "id": "58f03fa5-92db-40b1-a079-f5bee207168f",
          "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
          "title": "T3 Validation Trip",
          "days": [
            {
              "id": "177d8f48-dca4-45bd-9e95-c713f53180b1",
              "title": "1일차",
              "color": "#2563eb",
              "places": [
                {
                  "id": "1ce589b3-eb83-461d-b672-0d3657fddc76",
                  "placeId": "fixture-place-shibuya",
                  "name": "시부야",
                  "location": {
                    "lat": 35.6595,
                    "lng": 139.7005
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 1
                },
                {
                  "id": "57802cde-12b7-4eee-8a77-49c9082784f0",
                  "placeId": "fixture-place-ueno",
                  "name": "우에노 공원",
                  "location": {
                    "lat": 35.7148,
                    "lng": 139.7732
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 2
                }
              ],
              "polylines": [
                {
                  "id": "fa47903d-0fbd-426a-992b-04b92e6ea531",
                  "fromPlaceId": "1ce589b3-eb83-461d-b672-0d3657fddc76",
                  "toPlaceId": "57802cde-12b7-4eee-8a77-49c9082784f0",
                  "mode": "straight",
                  "order": 1
                }
              ],
              "layerItems": [
                {
                  "type": "place",
                  "id": "1ce589b3-eb83-461d-b672-0d3657fddc76"
                },
                {
                  "type": "polyline",
                  "id": "fa47903d-0fbd-426a-992b-04b92e6ea531"
                },
                {
                  "type": "place",
                  "id": "57802cde-12b7-4eee-8a77-49c9082784f0"
                }
              ]
            },
            {
              "id": "f672e76d-9428-4be3-836d-2c08443ebd9f",
              "title": "2일차",
              "color": "#2563eb",
              "places": [
                {
                  "id": "0a828c0d-b714-4e35-b980-2c9d185b7a6b",
                  "placeId": "fixture-place-tower",
                  "name": "도쿄 타워",
                  "location": {
                    "lat": 35.6586,
                    "lng": 139.7454
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 1
                }
              ],
              "polylines": [],
              "layerItems": [
                {
                  "type": "place",
                  "id": "0a828c0d-b714-4e35-b980-2c9d185b7a6b"
                }
              ]
            }
          ],
          "createdAt": "2026-10-05T07:01:01.280Z",
          "updatedAt": "2026-10-05T07:01:01.280Z"
        },
        "after": {
          "id": "58f03fa5-92db-40b1-a079-f5bee207168f",
          "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
          "title": "T3 Validation Trip",
          "days": [
            {
              "id": "177d8f48-dca4-45bd-9e95-c713f53180b1",
              "title": "1일차",
              "color": "#2563eb",
              "places": [
                {
                  "id": "1ce589b3-eb83-461d-b672-0d3657fddc76",
                  "placeId": "fixture-place-shibuya",
                  "name": "시부야 스카이",
                  "location": {
                    "lat": 35.6595,
                    "lng": 139.7005
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 1
                },
                {
                  "id": "57802cde-12b7-4eee-8a77-49c9082784f0",
                  "placeId": "fixture-place-ueno",
                  "name": "우에노 공원",
                  "location": {
                    "lat": 35.7148,
                    "lng": 139.7732
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 2
                }
              ],
              "polylines": [
                {
                  "id": "fa47903d-0fbd-426a-992b-04b92e6ea531",
                  "fromPlaceId": "1ce589b3-eb83-461d-b672-0d3657fddc76",
                  "toPlaceId": "57802cde-12b7-4eee-8a77-49c9082784f0",
                  "mode": "straight",
                  "order": 1
                }
              ],
              "layerItems": [
                {
                  "type": "place",
                  "id": "1ce589b3-eb83-461d-b672-0d3657fddc76"
                },
                {
                  "type": "polyline",
                  "id": "fa47903d-0fbd-426a-992b-04b92e6ea531"
                },
                {
                  "type": "place",
                  "id": "57802cde-12b7-4eee-8a77-49c9082784f0"
                }
              ]
            },
            {
              "id": "f672e76d-9428-4be3-836d-2c08443ebd9f",
              "title": "2일차",
              "color": "#2563eb",
              "places": [
                {
                  "id": "0a828c0d-b714-4e35-b980-2c9d185b7a6b",
                  "placeId": "fixture-place-tower",
                  "name": "도쿄 타워",
                  "location": {
                    "lat": 35.6586,
                    "lng": 139.7454
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 1
                }
              ],
              "polylines": [],
              "layerItems": [
                {
                  "type": "place",
                  "id": "0a828c0d-b714-4e35-b980-2c9d185b7a6b"
                }
              ]
            }
          ],
          "createdAt": "2026-10-05T07:01:01.280Z",
          "updatedAt": "2026-10-05T07:01:01.280Z"
        }
      },
      "execution": "PASS",
      "save": "PASS",
      "reload": "PASS",
      "after": {
        "id": "58f03fa5-92db-40b1-a079-f5bee207168f",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "177d8f48-dca4-45bd-9e95-c713f53180b1",
            "title": "1일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "1ce589b3-eb83-461d-b672-0d3657fddc76",
                "placeId": "fixture-place-shibuya",
                "name": "시부야 스카이",
                "location": {
                  "lat": 35.6595,
                  "lng": 139.7005
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              },
              {
                "id": "57802cde-12b7-4eee-8a77-49c9082784f0",
                "placeId": "fixture-place-ueno",
                "name": "우에노 공원",
                "location": {
                  "lat": 35.7148,
                  "lng": 139.7732
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 2
              }
            ],
            "polylines": [
              {
                "id": "fa47903d-0fbd-426a-992b-04b92e6ea531",
                "fromPlaceId": "1ce589b3-eb83-461d-b672-0d3657fddc76",
                "toPlaceId": "57802cde-12b7-4eee-8a77-49c9082784f0",
                "mode": "straight",
                "order": 1
              }
            ],
            "layerItems": [
              {
                "type": "place",
                "id": "1ce589b3-eb83-461d-b672-0d3657fddc76"
              },
              {
                "type": "polyline",
                "id": "fa47903d-0fbd-426a-992b-04b92e6ea531"
              },
              {
                "type": "place",
                "id": "57802cde-12b7-4eee-8a77-49c9082784f0"
              }
            ]
          },
          {
            "id": "f672e76d-9428-4be3-836d-2c08443ebd9f",
            "title": "2일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "0a828c0d-b714-4e35-b980-2c9d185b7a6b",
                "placeId": "fixture-place-tower",
                "name": "도쿄 타워",
                "location": {
                  "lat": 35.6586,
                  "lng": 139.7454
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              }
            ],
            "polylines": [],
            "layerItems": [
              {
                "type": "place",
                "id": "0a828c0d-b714-4e35-b980-2c9d185b7a6b"
              }
            ]
          }
        ],
        "createdAt": "2026-10-05T07:01:01.280Z",
        "updatedAt": "2026-10-05T07:01:08.895Z"
      },
      "intentMatch": "PASS",
      "errorsFixes": [],
      "latency": {
        "modelRequestMs": 7578.300000071526,
        "prepareMs": 1.399999976158142,
        "executeMs": 0.20000004768371582,
        "saveMs": 13.299999952316284,
        "reloadMs": 2.399999976158142,
        "totalMs": 7631.899999976158
      },
      "status": "PASS"
    },
    {
      "scenarioId": "T3-S09",
      "request": "1일차의 시부야 메모를 야경으로 설정해줘.",
      "before": {
        "id": "2aac9c11-a962-4a67-8081-5b34141614a8",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "8958acc4-9e8e-481b-87c0-11cf1c6bb10f",
            "title": "1일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "c85ebe65-72d0-4ab7-9ac3-cb3239983109",
                "placeId": "fixture-place-shibuya",
                "name": "시부야",
                "location": {
                  "lat": 35.6595,
                  "lng": 139.7005
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              },
              {
                "id": "71eebc97-ea48-45b9-9022-f93f2cb31474",
                "placeId": "fixture-place-ueno",
                "name": "우에노 공원",
                "location": {
                  "lat": 35.7148,
                  "lng": 139.7732
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 2
              }
            ],
            "polylines": [
              {
                "id": "2b5fc3dc-94a5-4a56-9093-66788fc0cda4",
                "fromPlaceId": "c85ebe65-72d0-4ab7-9ac3-cb3239983109",
                "toPlaceId": "71eebc97-ea48-45b9-9022-f93f2cb31474",
                "mode": "straight",
                "order": 1
              }
            ],
            "layerItems": [
              {
                "type": "place",
                "id": "c85ebe65-72d0-4ab7-9ac3-cb3239983109"
              },
              {
                "type": "polyline",
                "id": "2b5fc3dc-94a5-4a56-9093-66788fc0cda4"
              },
              {
                "type": "place",
                "id": "71eebc97-ea48-45b9-9022-f93f2cb31474"
              }
            ]
          },
          {
            "id": "b9f2eb4c-9e44-4f3b-a690-934fbeb0cca1",
            "title": "2일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "635bfc55-f8f7-4d00-9121-64a705582848",
                "placeId": "fixture-place-tower",
                "name": "도쿄 타워",
                "location": {
                  "lat": 35.6586,
                  "lng": 139.7454
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              }
            ],
            "polylines": [],
            "layerItems": [
              {
                "type": "place",
                "id": "635bfc55-f8f7-4d00-9121-64a705582848"
              }
            ]
          }
        ],
        "createdAt": "2026-10-05T07:01:08.909Z",
        "updatedAt": "2026-10-05T07:01:08.909Z"
      },
      "provider": "openwebui",
      "model": "qwen3.5:2b",
      "rawOutput": "{\"version\":1,\"base\":{\"tripId\":\"2aac9c11-a962-4a67-8081-5b34141614a8\",\"fingerprint\":\"sha256:9110bb02e6278f01a3db381f5d2159dbdccd7bb367c7e844a9ffd00f954ca4c6\"},\"operations\":[{\"stepId\":\"s1\",\"op\":\"set_memo\",\"place\":{\"kind\":\"id\",\"id\":\"c85ebe65-72d0-4ab7-9ac3-cb3239983109\"},\"memo\":\"야경\"}]}",
      "commandSequence": [
        {
          "stepId": "s1",
          "op": "set_memo",
          "place": {
            "kind": "id",
            "id": "c85ebe65-72d0-4ab7-9ac3-cb3239983109"
          },
          "memo": "야경"
        }
      ],
      "validation": "PASS",
      "preview": {
        "operationCount": 1,
        "commandCount": 2,
        "diff": [
          {
            "op": "set_memo",
            "placeId": "c85ebe65-72d0-4ab7-9ac3-cb3239983109",
            "after": "야경"
          }
        ],
        "risk": {
          "characteristics": ["metadata_edit"]
        },
        "before": {
          "id": "2aac9c11-a962-4a67-8081-5b34141614a8",
          "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
          "title": "T3 Validation Trip",
          "days": [
            {
              "id": "8958acc4-9e8e-481b-87c0-11cf1c6bb10f",
              "title": "1일차",
              "color": "#2563eb",
              "places": [
                {
                  "id": "c85ebe65-72d0-4ab7-9ac3-cb3239983109",
                  "placeId": "fixture-place-shibuya",
                  "name": "시부야",
                  "location": {
                    "lat": 35.6595,
                    "lng": 139.7005
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 1
                },
                {
                  "id": "71eebc97-ea48-45b9-9022-f93f2cb31474",
                  "placeId": "fixture-place-ueno",
                  "name": "우에노 공원",
                  "location": {
                    "lat": 35.7148,
                    "lng": 139.7732
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 2
                }
              ],
              "polylines": [
                {
                  "id": "2b5fc3dc-94a5-4a56-9093-66788fc0cda4",
                  "fromPlaceId": "c85ebe65-72d0-4ab7-9ac3-cb3239983109",
                  "toPlaceId": "71eebc97-ea48-45b9-9022-f93f2cb31474",
                  "mode": "straight",
                  "order": 1
                }
              ],
              "layerItems": [
                {
                  "type": "place",
                  "id": "c85ebe65-72d0-4ab7-9ac3-cb3239983109"
                },
                {
                  "type": "polyline",
                  "id": "2b5fc3dc-94a5-4a56-9093-66788fc0cda4"
                },
                {
                  "type": "place",
                  "id": "71eebc97-ea48-45b9-9022-f93f2cb31474"
                }
              ]
            },
            {
              "id": "b9f2eb4c-9e44-4f3b-a690-934fbeb0cca1",
              "title": "2일차",
              "color": "#2563eb",
              "places": [
                {
                  "id": "635bfc55-f8f7-4d00-9121-64a705582848",
                  "placeId": "fixture-place-tower",
                  "name": "도쿄 타워",
                  "location": {
                    "lat": 35.6586,
                    "lng": 139.7454
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 1
                }
              ],
              "polylines": [],
              "layerItems": [
                {
                  "type": "place",
                  "id": "635bfc55-f8f7-4d00-9121-64a705582848"
                }
              ]
            }
          ],
          "createdAt": "2026-10-05T07:01:08.909Z",
          "updatedAt": "2026-10-05T07:01:08.909Z"
        },
        "after": {
          "id": "2aac9c11-a962-4a67-8081-5b34141614a8",
          "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
          "title": "T3 Validation Trip",
          "days": [
            {
              "id": "8958acc4-9e8e-481b-87c0-11cf1c6bb10f",
              "title": "1일차",
              "color": "#2563eb",
              "places": [
                {
                  "id": "c85ebe65-72d0-4ab7-9ac3-cb3239983109",
                  "placeId": "fixture-place-shibuya",
                  "name": "시부야",
                  "location": {
                    "lat": 35.6595,
                    "lng": 139.7005
                  },
                  "memo": "야경",
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 1
                },
                {
                  "id": "71eebc97-ea48-45b9-9022-f93f2cb31474",
                  "placeId": "fixture-place-ueno",
                  "name": "우에노 공원",
                  "location": {
                    "lat": 35.7148,
                    "lng": 139.7732
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 2
                }
              ],
              "polylines": [
                {
                  "id": "2b5fc3dc-94a5-4a56-9093-66788fc0cda4",
                  "fromPlaceId": "c85ebe65-72d0-4ab7-9ac3-cb3239983109",
                  "toPlaceId": "71eebc97-ea48-45b9-9022-f93f2cb31474",
                  "mode": "straight",
                  "order": 1
                }
              ],
              "layerItems": [
                {
                  "type": "place",
                  "id": "c85ebe65-72d0-4ab7-9ac3-cb3239983109"
                },
                {
                  "type": "polyline",
                  "id": "2b5fc3dc-94a5-4a56-9093-66788fc0cda4"
                },
                {
                  "type": "place",
                  "id": "71eebc97-ea48-45b9-9022-f93f2cb31474"
                }
              ]
            },
            {
              "id": "b9f2eb4c-9e44-4f3b-a690-934fbeb0cca1",
              "title": "2일차",
              "color": "#2563eb",
              "places": [
                {
                  "id": "635bfc55-f8f7-4d00-9121-64a705582848",
                  "placeId": "fixture-place-tower",
                  "name": "도쿄 타워",
                  "location": {
                    "lat": 35.6586,
                    "lng": 139.7454
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 1
                }
              ],
              "polylines": [],
              "layerItems": [
                {
                  "type": "place",
                  "id": "635bfc55-f8f7-4d00-9121-64a705582848"
                }
              ]
            }
          ],
          "createdAt": "2026-10-05T07:01:08.909Z",
          "updatedAt": "2026-10-05T07:01:08.909Z"
        }
      },
      "execution": "PASS",
      "save": "PASS",
      "reload": "PASS",
      "after": {
        "id": "2aac9c11-a962-4a67-8081-5b34141614a8",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "8958acc4-9e8e-481b-87c0-11cf1c6bb10f",
            "title": "1일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "c85ebe65-72d0-4ab7-9ac3-cb3239983109",
                "placeId": "fixture-place-shibuya",
                "name": "시부야",
                "location": {
                  "lat": 35.6595,
                  "lng": 139.7005
                },
                "memo": "야경",
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              },
              {
                "id": "71eebc97-ea48-45b9-9022-f93f2cb31474",
                "placeId": "fixture-place-ueno",
                "name": "우에노 공원",
                "location": {
                  "lat": 35.7148,
                  "lng": 139.7732
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 2
              }
            ],
            "polylines": [
              {
                "id": "2b5fc3dc-94a5-4a56-9093-66788fc0cda4",
                "fromPlaceId": "c85ebe65-72d0-4ab7-9ac3-cb3239983109",
                "toPlaceId": "71eebc97-ea48-45b9-9022-f93f2cb31474",
                "mode": "straight",
                "order": 1
              }
            ],
            "layerItems": [
              {
                "type": "place",
                "id": "c85ebe65-72d0-4ab7-9ac3-cb3239983109"
              },
              {
                "type": "polyline",
                "id": "2b5fc3dc-94a5-4a56-9093-66788fc0cda4"
              },
              {
                "type": "place",
                "id": "71eebc97-ea48-45b9-9022-f93f2cb31474"
              }
            ]
          },
          {
            "id": "b9f2eb4c-9e44-4f3b-a690-934fbeb0cca1",
            "title": "2일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "635bfc55-f8f7-4d00-9121-64a705582848",
                "placeId": "fixture-place-tower",
                "name": "도쿄 타워",
                "location": {
                  "lat": 35.6586,
                  "lng": 139.7454
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              }
            ],
            "polylines": [],
            "layerItems": [
              {
                "type": "place",
                "id": "635bfc55-f8f7-4d00-9121-64a705582848"
              }
            ]
          }
        ],
        "createdAt": "2026-10-05T07:01:08.909Z",
        "updatedAt": "2026-10-05T07:01:21.186Z"
      },
      "intentMatch": "PASS",
      "errorsFixes": [],
      "latency": {
        "modelRequestMs": 12242.600000023842,
        "prepareMs": 1,
        "executeMs": 1.6999999284744263,
        "saveMs": 11.200000047683716,
        "reloadMs": 3.6999999284744263,
        "totalMs": 12296.399999976158
      },
      "status": "PASS"
    },
    {
      "scenarioId": "T3-S10",
      "request": "1일차의 시부야 방문 시작 시간을 오후 2시로 바꿔줘.",
      "before": {
        "id": "b0da13c3-9569-4bd5-8c58-c8da8fe1a646",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "4a3ae9cb-2d0a-4f8b-bd84-af1d7b271f8b",
            "title": "1일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "13610bd3-3f34-4e97-8963-40a6dd23495a",
                "placeId": "fixture-place-shibuya",
                "name": "시부야",
                "location": {
                  "lat": 35.6595,
                  "lng": 139.7005
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              },
              {
                "id": "03abbeff-dc34-4235-9282-cf3a2ec5534d",
                "placeId": "fixture-place-ueno",
                "name": "우에노 공원",
                "location": {
                  "lat": 35.7148,
                  "lng": 139.7732
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 2
              }
            ],
            "polylines": [
              {
                "id": "c02132bd-008d-4104-9b06-fd3c67e30e80",
                "fromPlaceId": "13610bd3-3f34-4e97-8963-40a6dd23495a",
                "toPlaceId": "03abbeff-dc34-4235-9282-cf3a2ec5534d",
                "mode": "straight",
                "order": 1
              }
            ],
            "layerItems": [
              {
                "type": "place",
                "id": "13610bd3-3f34-4e97-8963-40a6dd23495a"
              },
              {
                "type": "polyline",
                "id": "c02132bd-008d-4104-9b06-fd3c67e30e80"
              },
              {
                "type": "place",
                "id": "03abbeff-dc34-4235-9282-cf3a2ec5534d"
              }
            ]
          },
          {
            "id": "d4f2d3ef-9c20-4889-b626-8293aa200f81",
            "title": "2일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "33928031-f66a-4307-8592-5d2ea0cbd074",
                "placeId": "fixture-place-tower",
                "name": "도쿄 타워",
                "location": {
                  "lat": 35.6586,
                  "lng": 139.7454
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              }
            ],
            "polylines": [],
            "layerItems": [
              {
                "type": "place",
                "id": "33928031-f66a-4307-8592-5d2ea0cbd074"
              }
            ]
          }
        ],
        "createdAt": "2026-10-05T07:01:21.208Z",
        "updatedAt": "2026-10-05T07:01:21.208Z"
      },
      "provider": "openwebui",
      "model": "qwen3.5:2b",
      "rawOutput": "{\"version\":1,\"base\":{\"tripId\":\"b0da13c3-9569-4bd5-8c58-c8da8fe1a646\",\"fingerprint\":\"sha256:e993c3d0a9a69003748e062aa6e449847664a99534ae432f3241a07eeba8b417\"},\"operations\":[{\"stepId\":\"s1\",\"op\":\"set_visit_time\",\"place\":{\"kind\":\"id\",\"id\":\"13610bd3-3f34-4e97-8963-40a6dd23495a\"},\"time\":\"14:00\"}]}",
      "commandSequence": [
        {
          "stepId": "s1",
          "op": "set_visit_time",
          "place": {
            "kind": "id",
            "id": "13610bd3-3f34-4e97-8963-40a6dd23495a"
          },
          "time": "14:00"
        }
      ],
      "validation": "PASS",
      "preview": {
        "operationCount": 1,
        "commandCount": 2,
        "diff": [
          {
            "op": "set_visit_time",
            "placeId": "13610bd3-3f34-4e97-8963-40a6dd23495a",
            "before": "10:00",
            "after": "14:00"
          }
        ],
        "risk": {
          "characteristics": ["metadata_edit"]
        },
        "before": {
          "id": "b0da13c3-9569-4bd5-8c58-c8da8fe1a646",
          "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
          "title": "T3 Validation Trip",
          "days": [
            {
              "id": "4a3ae9cb-2d0a-4f8b-bd84-af1d7b271f8b",
              "title": "1일차",
              "color": "#2563eb",
              "places": [
                {
                  "id": "13610bd3-3f34-4e97-8963-40a6dd23495a",
                  "placeId": "fixture-place-shibuya",
                  "name": "시부야",
                  "location": {
                    "lat": 35.6595,
                    "lng": 139.7005
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 1
                },
                {
                  "id": "03abbeff-dc34-4235-9282-cf3a2ec5534d",
                  "placeId": "fixture-place-ueno",
                  "name": "우에노 공원",
                  "location": {
                    "lat": 35.7148,
                    "lng": 139.7732
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 2
                }
              ],
              "polylines": [
                {
                  "id": "c02132bd-008d-4104-9b06-fd3c67e30e80",
                  "fromPlaceId": "13610bd3-3f34-4e97-8963-40a6dd23495a",
                  "toPlaceId": "03abbeff-dc34-4235-9282-cf3a2ec5534d",
                  "mode": "straight",
                  "order": 1
                }
              ],
              "layerItems": [
                {
                  "type": "place",
                  "id": "13610bd3-3f34-4e97-8963-40a6dd23495a"
                },
                {
                  "type": "polyline",
                  "id": "c02132bd-008d-4104-9b06-fd3c67e30e80"
                },
                {
                  "type": "place",
                  "id": "03abbeff-dc34-4235-9282-cf3a2ec5534d"
                }
              ]
            },
            {
              "id": "d4f2d3ef-9c20-4889-b626-8293aa200f81",
              "title": "2일차",
              "color": "#2563eb",
              "places": [
                {
                  "id": "33928031-f66a-4307-8592-5d2ea0cbd074",
                  "placeId": "fixture-place-tower",
                  "name": "도쿄 타워",
                  "location": {
                    "lat": 35.6586,
                    "lng": 139.7454
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 1
                }
              ],
              "polylines": [],
              "layerItems": [
                {
                  "type": "place",
                  "id": "33928031-f66a-4307-8592-5d2ea0cbd074"
                }
              ]
            }
          ],
          "createdAt": "2026-10-05T07:01:21.208Z",
          "updatedAt": "2026-10-05T07:01:21.208Z"
        },
        "after": {
          "id": "b0da13c3-9569-4bd5-8c58-c8da8fe1a646",
          "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
          "title": "T3 Validation Trip",
          "days": [
            {
              "id": "4a3ae9cb-2d0a-4f8b-bd84-af1d7b271f8b",
              "title": "1일차",
              "color": "#2563eb",
              "places": [
                {
                  "id": "13610bd3-3f34-4e97-8963-40a6dd23495a",
                  "placeId": "fixture-place-shibuya",
                  "name": "시부야",
                  "location": {
                    "lat": 35.6595,
                    "lng": 139.7005
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "14:00",
                  "order": 1
                },
                {
                  "id": "03abbeff-dc34-4235-9282-cf3a2ec5534d",
                  "placeId": "fixture-place-ueno",
                  "name": "우에노 공원",
                  "location": {
                    "lat": 35.7148,
                    "lng": 139.7732
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 2
                }
              ],
              "polylines": [
                {
                  "id": "c02132bd-008d-4104-9b06-fd3c67e30e80",
                  "fromPlaceId": "13610bd3-3f34-4e97-8963-40a6dd23495a",
                  "toPlaceId": "03abbeff-dc34-4235-9282-cf3a2ec5534d",
                  "mode": "straight",
                  "order": 1
                }
              ],
              "layerItems": [
                {
                  "type": "place",
                  "id": "13610bd3-3f34-4e97-8963-40a6dd23495a"
                },
                {
                  "type": "polyline",
                  "id": "c02132bd-008d-4104-9b06-fd3c67e30e80"
                },
                {
                  "type": "place",
                  "id": "03abbeff-dc34-4235-9282-cf3a2ec5534d"
                }
              ]
            },
            {
              "id": "d4f2d3ef-9c20-4889-b626-8293aa200f81",
              "title": "2일차",
              "color": "#2563eb",
              "places": [
                {
                  "id": "33928031-f66a-4307-8592-5d2ea0cbd074",
                  "placeId": "fixture-place-tower",
                  "name": "도쿄 타워",
                  "location": {
                    "lat": 35.6586,
                    "lng": 139.7454
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 1
                }
              ],
              "polylines": [],
              "layerItems": [
                {
                  "type": "place",
                  "id": "33928031-f66a-4307-8592-5d2ea0cbd074"
                }
              ]
            }
          ],
          "createdAt": "2026-10-05T07:01:21.208Z",
          "updatedAt": "2026-10-05T07:01:21.208Z"
        }
      },
      "execution": "PASS",
      "save": "PASS",
      "reload": "PASS",
      "after": {
        "id": "b0da13c3-9569-4bd5-8c58-c8da8fe1a646",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "4a3ae9cb-2d0a-4f8b-bd84-af1d7b271f8b",
            "title": "1일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "13610bd3-3f34-4e97-8963-40a6dd23495a",
                "placeId": "fixture-place-shibuya",
                "name": "시부야",
                "location": {
                  "lat": 35.6595,
                  "lng": 139.7005
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "14:00",
                "order": 1
              },
              {
                "id": "03abbeff-dc34-4235-9282-cf3a2ec5534d",
                "placeId": "fixture-place-ueno",
                "name": "우에노 공원",
                "location": {
                  "lat": 35.7148,
                  "lng": 139.7732
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 2
              }
            ],
            "polylines": [
              {
                "id": "c02132bd-008d-4104-9b06-fd3c67e30e80",
                "fromPlaceId": "13610bd3-3f34-4e97-8963-40a6dd23495a",
                "toPlaceId": "03abbeff-dc34-4235-9282-cf3a2ec5534d",
                "mode": "straight",
                "order": 1
              }
            ],
            "layerItems": [
              {
                "type": "place",
                "id": "13610bd3-3f34-4e97-8963-40a6dd23495a"
              },
              {
                "type": "polyline",
                "id": "c02132bd-008d-4104-9b06-fd3c67e30e80"
              },
              {
                "type": "place",
                "id": "03abbeff-dc34-4235-9282-cf3a2ec5534d"
              }
            ]
          },
          {
            "id": "d4f2d3ef-9c20-4889-b626-8293aa200f81",
            "title": "2일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "33928031-f66a-4307-8592-5d2ea0cbd074",
                "placeId": "fixture-place-tower",
                "name": "도쿄 타워",
                "location": {
                  "lat": 35.6586,
                  "lng": 139.7454
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              }
            ],
            "polylines": [],
            "layerItems": [
              {
                "type": "place",
                "id": "33928031-f66a-4307-8592-5d2ea0cbd074"
              }
            ]
          }
        ],
        "createdAt": "2026-10-05T07:01:21.208Z",
        "updatedAt": "2026-10-05T07:01:29.004Z"
      },
      "intentMatch": "PASS",
      "errorsFixes": [],
      "latency": {
        "modelRequestMs": 7772.200000047684,
        "prepareMs": 0.5,
        "executeMs": 0.5,
        "saveMs": 9,
        "reloadMs": 2.200000047683716,
        "totalMs": 7809.800000071526
      },
      "status": "PASS"
    },
    {
      "scenarioId": "T3-S11",
      "request": "1일차의 시부야 방문 시간을 90분으로 바꿔줘.",
      "before": {
        "id": "29d9fc33-3a42-421f-93d4-69741dcf286a",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "e53ed4b0-ea64-4569-b916-169ee25fbb70",
            "title": "1일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "14dae65e-07fd-4f76-abea-28e1f8c99dc2",
                "placeId": "fixture-place-shibuya",
                "name": "시부야",
                "location": {
                  "lat": 35.6595,
                  "lng": 139.7005
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              },
              {
                "id": "f0ee52cf-e92d-4da0-abb5-d04374c011b4",
                "placeId": "fixture-place-ueno",
                "name": "우에노 공원",
                "location": {
                  "lat": 35.7148,
                  "lng": 139.7732
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 2
              }
            ],
            "polylines": [
              {
                "id": "8c485afe-54ed-4576-8241-f3aa438265e3",
                "fromPlaceId": "14dae65e-07fd-4f76-abea-28e1f8c99dc2",
                "toPlaceId": "f0ee52cf-e92d-4da0-abb5-d04374c011b4",
                "mode": "straight",
                "order": 1
              }
            ],
            "layerItems": [
              {
                "type": "place",
                "id": "14dae65e-07fd-4f76-abea-28e1f8c99dc2"
              },
              {
                "type": "polyline",
                "id": "8c485afe-54ed-4576-8241-f3aa438265e3"
              },
              {
                "type": "place",
                "id": "f0ee52cf-e92d-4da0-abb5-d04374c011b4"
              }
            ]
          },
          {
            "id": "90ad8b09-e1e2-4645-bc1f-176894bf2f05",
            "title": "2일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "b09fe6af-7091-4bc3-97b0-8891c28ce14d",
                "placeId": "fixture-place-tower",
                "name": "도쿄 타워",
                "location": {
                  "lat": 35.6586,
                  "lng": 139.7454
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              }
            ],
            "polylines": [],
            "layerItems": [
              {
                "type": "place",
                "id": "b09fe6af-7091-4bc3-97b0-8891c28ce14d"
              }
            ]
          }
        ],
        "createdAt": "2026-10-05T07:01:29.018Z",
        "updatedAt": "2026-10-05T07:01:29.018Z"
      },
      "provider": "openwebui",
      "model": "qwen3.5:2b",
      "rawOutput": "{\"version\":1,\"base\":{\"tripId\":\"29d9fc33-3a42-421f-93d4-69741dcf286a\",\"fingerprint\":\"sha256:afc163e35979e117581d6ead92221c47c70336b5410bc0be118a077bc6e28a2c\"},\"operations\":[{\"stepId\":\"s1\",\"op\":\"set_visit_time\",\"place\":{\"kind\":\"id\",\"id\":\"14dae65e-07fd-4f76-abea-28e1f8c99dc2\"},\"time\":\"90\"}]}",
      "commandSequence": [],
      "validation": "NOT_RUN",
      "preview": null,
      "execution": "NOT_RUN",
      "save": "NOT_RUN",
      "reload": "NOT_RUN",
      "after": null,
      "intentMatch": "NOT_RUN",
      "errorsFixes": [
        "PARSER_SCHEMA_FAILURE: schema_invalid: MODEL_RESPONSE_FAILED_TRIP_COMMAND_PLAN_SCHEMA"
      ],
      "latency": {
        "modelRequestMs": 7592.800000071526,
        "prepareMs": null,
        "executeMs": null,
        "saveMs": null,
        "reloadMs": null,
        "totalMs": 7611.099999904633
      },
      "status": "FAIL"
    },
    {
      "scenarioId": "T3-S12",
      "request": "1일차의 시부야 선호 체류 시간을 120분으로 바꿔줘.",
      "before": {
        "id": "a1e851ab-713f-43b9-8f3b-0a870ac56acd",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "ac030f40-917c-4497-aa79-cdb18bd7e2c7",
            "title": "1일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "2ad74a1e-dc60-4ba3-9d73-0807f0f96ea7",
                "placeId": "fixture-place-shibuya",
                "name": "시부야",
                "location": {
                  "lat": 35.6595,
                  "lng": 139.7005
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              },
              {
                "id": "ea14f408-1d46-4780-ab46-b2fff8cc33df",
                "placeId": "fixture-place-ueno",
                "name": "우에노 공원",
                "location": {
                  "lat": 35.7148,
                  "lng": 139.7732
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 2
              }
            ],
            "polylines": [
              {
                "id": "6e7523fe-33bf-40dc-82b8-f71e6a740e09",
                "fromPlaceId": "2ad74a1e-dc60-4ba3-9d73-0807f0f96ea7",
                "toPlaceId": "ea14f408-1d46-4780-ab46-b2fff8cc33df",
                "mode": "straight",
                "order": 1
              }
            ],
            "layerItems": [
              {
                "type": "place",
                "id": "2ad74a1e-dc60-4ba3-9d73-0807f0f96ea7"
              },
              {
                "type": "polyline",
                "id": "6e7523fe-33bf-40dc-82b8-f71e6a740e09"
              },
              {
                "type": "place",
                "id": "ea14f408-1d46-4780-ab46-b2fff8cc33df"
              }
            ]
          },
          {
            "id": "47f0cb18-f8a5-4ce9-a576-d95f4ec7317e",
            "title": "2일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "2acc00eb-9aab-4616-85ae-d00ae2f0fdc6",
                "placeId": "fixture-place-tower",
                "name": "도쿄 타워",
                "location": {
                  "lat": 35.6586,
                  "lng": 139.7454
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              }
            ],
            "polylines": [],
            "layerItems": [
              {
                "type": "place",
                "id": "2acc00eb-9aab-4616-85ae-d00ae2f0fdc6"
              }
            ]
          }
        ],
        "createdAt": "2026-10-05T07:01:36.633Z",
        "updatedAt": "2026-10-05T07:01:36.633Z"
      },
      "provider": "openwebui",
      "model": "qwen3.5:2b",
      "rawOutput": "{\"version\":1,\"base\":{\"tripId\":\"a1e851ab-713f-43b9-8f3b-0a870ac56acd\",\"fingerprint\":\"sha256:4f43e39d8e7da5d9b6e0f14d117e9857496b39d4ad9c7d5b8f2c11581957f0b9\"},\"operations\":[{\"stepId\":\"s1\",\"op\":\"set_preferred_duration\",\"place\":{\"kind\":\"id\",\"id\":\"2ad74a1e-dc60-4ba3-9d73-0807f0f96ea7\"},\"minutes\":120}]}",
      "commandSequence": [
        {
          "stepId": "s1",
          "op": "set_preferred_duration",
          "place": {
            "kind": "id",
            "id": "2ad74a1e-dc60-4ba3-9d73-0807f0f96ea7"
          },
          "minutes": 120
        }
      ],
      "validation": "PASS",
      "preview": {
        "operationCount": 1,
        "commandCount": 2,
        "diff": [
          {
            "op": "set_visit_duration",
            "placeId": "2ad74a1e-dc60-4ba3-9d73-0807f0f96ea7",
            "before": 60,
            "after": 120
          },
          {
            "op": "set_preferred_duration",
            "placeId": "2ad74a1e-dc60-4ba3-9d73-0807f0f96ea7",
            "before": 60,
            "after": 120
          }
        ],
        "risk": {
          "characteristics": ["metadata_edit"]
        },
        "before": {
          "id": "a1e851ab-713f-43b9-8f3b-0a870ac56acd",
          "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
          "title": "T3 Validation Trip",
          "days": [
            {
              "id": "ac030f40-917c-4497-aa79-cdb18bd7e2c7",
              "title": "1일차",
              "color": "#2563eb",
              "places": [
                {
                  "id": "2ad74a1e-dc60-4ba3-9d73-0807f0f96ea7",
                  "placeId": "fixture-place-shibuya",
                  "name": "시부야",
                  "location": {
                    "lat": 35.6595,
                    "lng": 139.7005
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 1
                },
                {
                  "id": "ea14f408-1d46-4780-ab46-b2fff8cc33df",
                  "placeId": "fixture-place-ueno",
                  "name": "우에노 공원",
                  "location": {
                    "lat": 35.7148,
                    "lng": 139.7732
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 2
                }
              ],
              "polylines": [
                {
                  "id": "6e7523fe-33bf-40dc-82b8-f71e6a740e09",
                  "fromPlaceId": "2ad74a1e-dc60-4ba3-9d73-0807f0f96ea7",
                  "toPlaceId": "ea14f408-1d46-4780-ab46-b2fff8cc33df",
                  "mode": "straight",
                  "order": 1
                }
              ],
              "layerItems": [
                {
                  "type": "place",
                  "id": "2ad74a1e-dc60-4ba3-9d73-0807f0f96ea7"
                },
                {
                  "type": "polyline",
                  "id": "6e7523fe-33bf-40dc-82b8-f71e6a740e09"
                },
                {
                  "type": "place",
                  "id": "ea14f408-1d46-4780-ab46-b2fff8cc33df"
                }
              ]
            },
            {
              "id": "47f0cb18-f8a5-4ce9-a576-d95f4ec7317e",
              "title": "2일차",
              "color": "#2563eb",
              "places": [
                {
                  "id": "2acc00eb-9aab-4616-85ae-d00ae2f0fdc6",
                  "placeId": "fixture-place-tower",
                  "name": "도쿄 타워",
                  "location": {
                    "lat": 35.6586,
                    "lng": 139.7454
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 1
                }
              ],
              "polylines": [],
              "layerItems": [
                {
                  "type": "place",
                  "id": "2acc00eb-9aab-4616-85ae-d00ae2f0fdc6"
                }
              ]
            }
          ],
          "createdAt": "2026-10-05T07:01:36.633Z",
          "updatedAt": "2026-10-05T07:01:36.633Z"
        },
        "after": {
          "id": "a1e851ab-713f-43b9-8f3b-0a870ac56acd",
          "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
          "title": "T3 Validation Trip",
          "days": [
            {
              "id": "ac030f40-917c-4497-aa79-cdb18bd7e2c7",
              "title": "1일차",
              "color": "#2563eb",
              "places": [
                {
                  "id": "2ad74a1e-dc60-4ba3-9d73-0807f0f96ea7",
                  "placeId": "fixture-place-shibuya",
                  "name": "시부야",
                  "location": {
                    "lat": 35.6595,
                    "lng": 139.7005
                  },
                  "visitDurationMinutes": 120,
                  "preferredDurationMinutes": 120,
                  "time": "10:00",
                  "order": 1
                },
                {
                  "id": "ea14f408-1d46-4780-ab46-b2fff8cc33df",
                  "placeId": "fixture-place-ueno",
                  "name": "우에노 공원",
                  "location": {
                    "lat": 35.7148,
                    "lng": 139.7732
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 2
                }
              ],
              "polylines": [
                {
                  "id": "6e7523fe-33bf-40dc-82b8-f71e6a740e09",
                  "fromPlaceId": "2ad74a1e-dc60-4ba3-9d73-0807f0f96ea7",
                  "toPlaceId": "ea14f408-1d46-4780-ab46-b2fff8cc33df",
                  "mode": "straight",
                  "order": 1
                }
              ],
              "layerItems": [
                {
                  "type": "place",
                  "id": "2ad74a1e-dc60-4ba3-9d73-0807f0f96ea7"
                },
                {
                  "type": "polyline",
                  "id": "6e7523fe-33bf-40dc-82b8-f71e6a740e09"
                },
                {
                  "type": "place",
                  "id": "ea14f408-1d46-4780-ab46-b2fff8cc33df"
                }
              ]
            },
            {
              "id": "47f0cb18-f8a5-4ce9-a576-d95f4ec7317e",
              "title": "2일차",
              "color": "#2563eb",
              "places": [
                {
                  "id": "2acc00eb-9aab-4616-85ae-d00ae2f0fdc6",
                  "placeId": "fixture-place-tower",
                  "name": "도쿄 타워",
                  "location": {
                    "lat": 35.6586,
                    "lng": 139.7454
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 1
                }
              ],
              "polylines": [],
              "layerItems": [
                {
                  "type": "place",
                  "id": "2acc00eb-9aab-4616-85ae-d00ae2f0fdc6"
                }
              ]
            }
          ],
          "createdAt": "2026-10-05T07:01:36.633Z",
          "updatedAt": "2026-10-05T07:01:36.633Z"
        }
      },
      "execution": "PASS",
      "save": "PASS",
      "reload": "PASS",
      "after": {
        "id": "a1e851ab-713f-43b9-8f3b-0a870ac56acd",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "ac030f40-917c-4497-aa79-cdb18bd7e2c7",
            "title": "1일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "2ad74a1e-dc60-4ba3-9d73-0807f0f96ea7",
                "placeId": "fixture-place-shibuya",
                "name": "시부야",
                "location": {
                  "lat": 35.6595,
                  "lng": 139.7005
                },
                "visitDurationMinutes": 120,
                "preferredDurationMinutes": 120,
                "time": "10:00",
                "order": 1
              },
              {
                "id": "ea14f408-1d46-4780-ab46-b2fff8cc33df",
                "placeId": "fixture-place-ueno",
                "name": "우에노 공원",
                "location": {
                  "lat": 35.7148,
                  "lng": 139.7732
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 2
              }
            ],
            "polylines": [
              {
                "id": "6e7523fe-33bf-40dc-82b8-f71e6a740e09",
                "fromPlaceId": "2ad74a1e-dc60-4ba3-9d73-0807f0f96ea7",
                "toPlaceId": "ea14f408-1d46-4780-ab46-b2fff8cc33df",
                "mode": "straight",
                "order": 1
              }
            ],
            "layerItems": [
              {
                "type": "place",
                "id": "2ad74a1e-dc60-4ba3-9d73-0807f0f96ea7"
              },
              {
                "type": "polyline",
                "id": "6e7523fe-33bf-40dc-82b8-f71e6a740e09"
              },
              {
                "type": "place",
                "id": "ea14f408-1d46-4780-ab46-b2fff8cc33df"
              }
            ]
          },
          {
            "id": "47f0cb18-f8a5-4ce9-a576-d95f4ec7317e",
            "title": "2일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "2acc00eb-9aab-4616-85ae-d00ae2f0fdc6",
                "placeId": "fixture-place-tower",
                "name": "도쿄 타워",
                "location": {
                  "lat": 35.6586,
                  "lng": 139.7454
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              }
            ],
            "polylines": [],
            "layerItems": [
              {
                "type": "place",
                "id": "2acc00eb-9aab-4616-85ae-d00ae2f0fdc6"
              }
            ]
          }
        ],
        "createdAt": "2026-10-05T07:01:36.633Z",
        "updatedAt": "2026-10-05T07:01:46.320Z"
      },
      "intentMatch": "PASS",
      "errorsFixes": [],
      "latency": {
        "modelRequestMs": 9660.100000023842,
        "prepareMs": 0.9000000953674316,
        "executeMs": 0.5,
        "saveMs": 9.600000023841858,
        "reloadMs": 1.6999999284744263,
        "totalMs": 9702.099999904633
      },
      "status": "PASS"
    },
    {
      "scenarioId": "T3-S13",
      "request": "1일차의 시부야에서 도쿄 타워로 이어지는 경로를 도보 모드로 바꿔줘.",
      "before": {
        "id": "70af35fd-f48c-4b1a-940b-9db6942feb52",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "bedb0c1a-ca65-4e24-b4b5-775f774f9329",
            "title": "1일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "8a34dfc8-0242-4927-bdc9-ba5cc0aa5ed3",
                "placeId": "fixture-place-shibuya",
                "name": "시부야",
                "location": {
                  "lat": 35.6595,
                  "lng": 139.7005
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              },
              {
                "id": "c525cabd-ca70-4bf0-90fd-199afc3a86bd",
                "placeId": "fixture-place-tower",
                "name": "도쿄 타워",
                "location": {
                  "lat": 35.6586,
                  "lng": 139.7454
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 2
              }
            ],
            "polylines": [
              {
                "id": "ce1fcad8-5f94-4dc6-9d1c-cd2559a048f7",
                "fromPlaceId": "8a34dfc8-0242-4927-bdc9-ba5cc0aa5ed3",
                "toPlaceId": "c525cabd-ca70-4bf0-90fd-199afc3a86bd",
                "mode": "straight",
                "order": 1
              }
            ],
            "layerItems": [
              {
                "type": "place",
                "id": "8a34dfc8-0242-4927-bdc9-ba5cc0aa5ed3"
              },
              {
                "type": "polyline",
                "id": "ce1fcad8-5f94-4dc6-9d1c-cd2559a048f7"
              },
              {
                "type": "place",
                "id": "c525cabd-ca70-4bf0-90fd-199afc3a86bd"
              }
            ]
          }
        ],
        "createdAt": "2026-10-05T07:01:46.333Z",
        "updatedAt": "2026-10-05T07:01:46.333Z"
      },
      "provider": "openwebui",
      "model": "qwen3.5:2b",
      "rawOutput": "{\"version\":1,\"base\":{\"tripId\":\"70af35fd-f48c-4b1a-940b-9db6942feb52\",\"fingerprint\":\"sha256:37aa051a1bbd85baa44e26392dbe18f006f7167aa2c2bafd7d9114c9f468c16f\"},\"operations\":[{\"stepId\":\"s1\",\"op\":\"set_polyline_mode\",\"polyline\":{\"kind\":\"id\",\"id\":\"ce1fcad8-5f94-4dc6-9d1c-cd2559a048f7\"},\"mode\":\"walking\"}]}",
      "commandSequence": [
        {
          "stepId": "s1",
          "op": "set_polyline_mode",
          "polyline": {
            "kind": "id",
            "id": "ce1fcad8-5f94-4dc6-9d1c-cd2559a048f7"
          },
          "mode": "walking"
        }
      ],
      "validation": "PASS",
      "preview": {
        "operationCount": 1,
        "commandCount": 2,
        "diff": [
          {
            "op": "set_polyline_mode",
            "polylineId": "ce1fcad8-5f94-4dc6-9d1c-cd2559a048f7",
            "before": "straight",
            "after": "walking"
          }
        ],
        "risk": {
          "characteristics": ["metadata_edit"]
        },
        "before": {
          "id": "70af35fd-f48c-4b1a-940b-9db6942feb52",
          "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
          "title": "T3 Validation Trip",
          "days": [
            {
              "id": "bedb0c1a-ca65-4e24-b4b5-775f774f9329",
              "title": "1일차",
              "color": "#2563eb",
              "places": [
                {
                  "id": "8a34dfc8-0242-4927-bdc9-ba5cc0aa5ed3",
                  "placeId": "fixture-place-shibuya",
                  "name": "시부야",
                  "location": {
                    "lat": 35.6595,
                    "lng": 139.7005
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 1
                },
                {
                  "id": "c525cabd-ca70-4bf0-90fd-199afc3a86bd",
                  "placeId": "fixture-place-tower",
                  "name": "도쿄 타워",
                  "location": {
                    "lat": 35.6586,
                    "lng": 139.7454
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 2
                }
              ],
              "polylines": [
                {
                  "id": "ce1fcad8-5f94-4dc6-9d1c-cd2559a048f7",
                  "fromPlaceId": "8a34dfc8-0242-4927-bdc9-ba5cc0aa5ed3",
                  "toPlaceId": "c525cabd-ca70-4bf0-90fd-199afc3a86bd",
                  "mode": "straight",
                  "order": 1
                }
              ],
              "layerItems": [
                {
                  "type": "place",
                  "id": "8a34dfc8-0242-4927-bdc9-ba5cc0aa5ed3"
                },
                {
                  "type": "polyline",
                  "id": "ce1fcad8-5f94-4dc6-9d1c-cd2559a048f7"
                },
                {
                  "type": "place",
                  "id": "c525cabd-ca70-4bf0-90fd-199afc3a86bd"
                }
              ]
            }
          ],
          "createdAt": "2026-10-05T07:01:46.333Z",
          "updatedAt": "2026-10-05T07:01:46.333Z"
        },
        "after": {
          "id": "70af35fd-f48c-4b1a-940b-9db6942feb52",
          "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
          "title": "T3 Validation Trip",
          "days": [
            {
              "id": "bedb0c1a-ca65-4e24-b4b5-775f774f9329",
              "title": "1일차",
              "color": "#2563eb",
              "places": [
                {
                  "id": "8a34dfc8-0242-4927-bdc9-ba5cc0aa5ed3",
                  "placeId": "fixture-place-shibuya",
                  "name": "시부야",
                  "location": {
                    "lat": 35.6595,
                    "lng": 139.7005
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 1
                },
                {
                  "id": "c525cabd-ca70-4bf0-90fd-199afc3a86bd",
                  "placeId": "fixture-place-tower",
                  "name": "도쿄 타워",
                  "location": {
                    "lat": 35.6586,
                    "lng": 139.7454
                  },
                  "visitDurationMinutes": 60,
                  "preferredDurationMinutes": 60,
                  "time": "10:00",
                  "order": 2
                }
              ],
              "polylines": [
                {
                  "id": "ce1fcad8-5f94-4dc6-9d1c-cd2559a048f7",
                  "fromPlaceId": "8a34dfc8-0242-4927-bdc9-ba5cc0aa5ed3",
                  "toPlaceId": "c525cabd-ca70-4bf0-90fd-199afc3a86bd",
                  "mode": "walking",
                  "order": 1
                }
              ],
              "layerItems": [
                {
                  "type": "place",
                  "id": "8a34dfc8-0242-4927-bdc9-ba5cc0aa5ed3"
                },
                {
                  "type": "polyline",
                  "id": "ce1fcad8-5f94-4dc6-9d1c-cd2559a048f7"
                },
                {
                  "type": "place",
                  "id": "c525cabd-ca70-4bf0-90fd-199afc3a86bd"
                }
              ]
            }
          ],
          "createdAt": "2026-10-05T07:01:46.333Z",
          "updatedAt": "2026-10-05T07:01:46.333Z"
        }
      },
      "execution": "PASS",
      "save": "PASS",
      "reload": "PASS",
      "after": {
        "id": "70af35fd-f48c-4b1a-940b-9db6942feb52",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "bedb0c1a-ca65-4e24-b4b5-775f774f9329",
            "title": "1일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "8a34dfc8-0242-4927-bdc9-ba5cc0aa5ed3",
                "placeId": "fixture-place-shibuya",
                "name": "시부야",
                "location": {
                  "lat": 35.6595,
                  "lng": 139.7005
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              },
              {
                "id": "c525cabd-ca70-4bf0-90fd-199afc3a86bd",
                "placeId": "fixture-place-tower",
                "name": "도쿄 타워",
                "location": {
                  "lat": 35.6586,
                  "lng": 139.7454
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 2
              }
            ],
            "polylines": [
              {
                "id": "ce1fcad8-5f94-4dc6-9d1c-cd2559a048f7",
                "fromPlaceId": "8a34dfc8-0242-4927-bdc9-ba5cc0aa5ed3",
                "toPlaceId": "c525cabd-ca70-4bf0-90fd-199afc3a86bd",
                "mode": "walking",
                "order": 1
              }
            ],
            "layerItems": [
              {
                "type": "place",
                "id": "8a34dfc8-0242-4927-bdc9-ba5cc0aa5ed3"
              },
              {
                "type": "polyline",
                "id": "ce1fcad8-5f94-4dc6-9d1c-cd2559a048f7"
              },
              {
                "type": "place",
                "id": "c525cabd-ca70-4bf0-90fd-199afc3a86bd"
              }
            ]
          }
        ],
        "createdAt": "2026-10-05T07:01:46.333Z",
        "updatedAt": "2026-10-05T07:01:54.778Z"
      },
      "intentMatch": "PASS",
      "errorsFixes": [],
      "latency": {
        "modelRequestMs": 8409.100000023842,
        "prepareMs": 2.1999999284744263,
        "executeMs": 0.2999999523162842,
        "saveMs": 7.799999952316284,
        "reloadMs": 2.200000047683716,
        "totalMs": 8457.299999952316
      },
      "status": "PASS"
    },
    {
      "scenarioId": "T3-C2",
      "request": "시부야를 1일차에서 2일차 마지막으로 옮기고 메모에 야경이라고 적어줘.",
      "before": {
        "id": "45843aee-8301-4093-afe1-f583e5ce420f",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "2e4f370a-8ff6-4be6-8d4d-ed73ebd90e00",
            "title": "1일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "1492e257-1e7b-4796-ba28-aed35fcaefa9",
                "placeId": "fixture-place-shibuya",
                "name": "시부야",
                "location": {
                  "lat": 35.6595,
                  "lng": 139.7005
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              },
              {
                "id": "21a13268-5dca-4ed8-8696-5191167c62d1",
                "placeId": "fixture-place-ueno",
                "name": "우에노 공원",
                "location": {
                  "lat": 35.7148,
                  "lng": 139.7732
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 2
              }
            ],
            "polylines": [
              {
                "id": "87823812-0132-4d6d-bbc1-02d77ccf39a8",
                "fromPlaceId": "1492e257-1e7b-4796-ba28-aed35fcaefa9",
                "toPlaceId": "21a13268-5dca-4ed8-8696-5191167c62d1",
                "mode": "straight",
                "order": 1
              }
            ],
            "layerItems": [
              {
                "type": "place",
                "id": "1492e257-1e7b-4796-ba28-aed35fcaefa9"
              },
              {
                "type": "polyline",
                "id": "87823812-0132-4d6d-bbc1-02d77ccf39a8"
              },
              {
                "type": "place",
                "id": "21a13268-5dca-4ed8-8696-5191167c62d1"
              }
            ]
          },
          {
            "id": "d9c60b3c-8f87-4edd-9b1c-1de5dab6f7d8",
            "title": "2일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "2fc07044-f875-4567-8c5b-0b617bbf7d29",
                "placeId": "fixture-place-tower",
                "name": "도쿄 타워",
                "location": {
                  "lat": 35.6586,
                  "lng": 139.7454
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              }
            ],
            "polylines": [],
            "layerItems": [
              {
                "type": "place",
                "id": "2fc07044-f875-4567-8c5b-0b617bbf7d29"
              }
            ]
          }
        ],
        "createdAt": "2026-10-05T07:01:54.791Z",
        "updatedAt": "2026-10-05T07:01:54.791Z"
      },
      "provider": "openwebui",
      "model": "qwen3.5:2b",
      "rawOutput": "{\"version\":1,\"base\":{\"tripId\":\"45843aee-8301-4093-afe1-f583e5ce420f\",\"fingerprint\":\"sha256:73c38dc9c52252a87aa8f8486328a69c5e493acb417ad38157987d6853b832fd\"},\"operations\":[{\"stepId\":\"s1\",\"op\":\"rename_trip\",\"title\":\"시부야를 1일차에서 2일차 마지막으로 옮기고 메모에 야경이라고 적어줘\"},{\"stepId\":\"s2\",\"op\":\"add_day\",\"title\":\"새로운 3일차 추가\"},{\"stepId\":\"s3\",\"op\":\"rename_day\",\"day\":{\"kind\":\"id\",\"id\":\"d9c60b3c-8f87-4edd-9b1c-1de5dab6f7d8\"},\"title\":\"3일차\"},{\"stepId\":\"s4\",\"op\":\"add_place\",\"day\":{\"kind\":\"id\",\"id\":\"d9c60b3c-",
      "commandSequence": [],
      "validation": "NOT_RUN",
      "preview": null,
      "execution": "NOT_RUN",
      "save": "NOT_RUN",
      "reload": "NOT_RUN",
      "after": null,
      "intentMatch": "NOT_RUN",
      "errorsFixes": [
        "PARSER_SCHEMA_FAILURE: json_parse: MODEL_RESPONSE_IS_NOT_ONE_JSON_DOCUMENT"
      ],
      "latency": {
        "modelRequestMs": 10946.100000023842,
        "prepareMs": null,
        "executeMs": null,
        "saveMs": null,
        "reloadMs": null,
        "totalMs": 10968.300000071526
      },
      "status": "FAIL"
    },
    {
      "scenarioId": "T3-C3",
      "request": "3일차를 새로 만들고 이 장소 세 개를 그쪽으로 옮겨줘.",
      "before": {
        "id": "a290a0e9-542d-4d3f-ac53-88413391af4c",
        "userId": "9aa5585e-ecf5-400a-a973-4ae371ce47d5",
        "title": "T3 Validation Trip",
        "days": [
          {
            "id": "a6756036-966d-4d37-b31c-ad06967a6559",
            "title": "1일차",
            "color": "#2563eb",
            "places": [
              {
                "id": "ae76d05b-9e0c-4cdf-8dcb-da708262599d",
                "placeId": "fixture-place-shibuya",
                "name": "시부야",
                "location": {
                  "lat": 35.6595,
                  "lng": 139.7005
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 1
              },
              {
                "id": "4b743816-3834-4b8f-bd1c-05694c1665c4",
                "placeId": "fixture-place-ueno",
                "name": "우에노 공원",
                "location": {
                  "lat": 35.7148,
                  "lng": 139.7732
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 2
              },
              {
                "id": "8b396cdf-0b50-44ee-8479-03a93bea5801",
                "placeId": "fixture-place-tower",
                "name": "도쿄 타워",
                "location": {
                  "lat": 35.6586,
                  "lng": 139.7454
                },
                "visitDurationMinutes": 60,
                "preferredDurationMinutes": 60,
                "time": "10:00",
                "order": 3
              }
            ],
            "polylines": [
              {
                "id": "daa1cf0c-de56-4168-8bed-467e2e5a2ea6",
                "fromPlaceId": "ae76d05b-9e0c-4cdf-8dcb-da708262599d",
                "toPlaceId": "4b743816-3834-4b8f-bd1c-05694c1665c4",
                "mode": "straight",
                "order": 1
              },
              {
                "id": "262b256e-6c5e-4f9f-a2c3-abf37670ffcf",
                "fromPlaceId": "4b743816-3834-4b8f-bd1c-05694c1665c4",
                "toPlaceId": "8b396cdf-0b50-44ee-8479-03a93bea5801",
                "mode": "straight",
                "order": 2
              }
            ],
            "layerItems": [
              {
                "type": "place",
                "id": "ae76d05b-9e0c-4cdf-8dcb-da708262599d"
              },
              {
                "type": "polyline",
                "id": "daa1cf0c-de56-4168-8bed-467e2e5a2ea6"
              },
              {
                "type": "place",
                "id": "4b743816-3834-4b8f-bd1c-05694c1665c4"
              },
              {
                "type": "polyline",
                "id": "262b256e-6c5e-4f9f-a2c3-abf37670ffcf"
              },
              {
                "type": "place",
                "id": "8b396cdf-0b50-44ee-8479-03a93bea5801"
              }
            ]
          },
          {
            "id": "18fb3bc6-15f4-46ff-b8b3-0ede2d6a16eb",
            "title": "2일차",
            "color": "#2563eb",
            "places": [],
            "polylines": [],
            "layerItems": []
          }
        ],
        "createdAt": "2026-10-05T07:02:05.761Z",
        "updatedAt": "2026-10-05T07:02:05.761Z"
      },
      "provider": "openwebui",
      "model": "qwen3.5:2b",
      "rawOutput": "```json\n{\"version\":1,\"base\":{\"tripId\":\"a290a0e9-542d-4d3f-ac53-88413391af4c\",\"fingerprint\":\"sha256:966cd54738b4b9bcce907bb1a2a73f1ded392eeadc953e34005a02225bc33d20\"},\"operations\":[{\"stepId\":\"s1\",\"op\":\"add_day\",\"title\":\"3일차 추가\"},{\"stepId\":\"s2\",\"op\":\"move_place\",\"place\":{\"kind\":\"id\",\"id\":\"ae76d05b-9e0c-4cdf-8dcb-da708262599d\"},\"day\":{\"kind\":\"id\",\"id\":\"18fb3bc6-15f4-46ff-b8b3-0ede2d6a16eb\"},\"position\":{\"kind\":\"start\"}},{\"stepId\":\"s3\",\"op\":\"move_place\",\"place\":{\"kind\":\"id\",\"id\":\"4b743816-383",
      "commandSequence": [],
      "validation": "NOT_RUN",
      "preview": null,
      "execution": "NOT_RUN",
      "save": "NOT_RUN",
      "reload": "NOT_RUN",
      "after": null,
      "intentMatch": "NOT_RUN",
      "errorsFixes": [
        "PARSER_SCHEMA_FAILURE: json_parse: MODEL_RESPONSE_FORMAT_IS_NOT_RAW_JSON_OR_JSON_FENCE"
      ],
      "latency": {
        "modelRequestMs": 12988.800000071526,
        "prepareMs": null,
        "executeMs": null,
        "saveMs": null,
        "reloadMs": null,
        "totalMs": 13062.199999928474
      },
      "status": "FAIL"
    }
  ]
}
````

## docs/trip-command-t3-model-diagnostic.md

SHA256: `0e120c0a896906ae987d2f571e9319f315e3c9ca2f52795eb4161d6269f1a219`; bytes: 3433.

````markdown
# T3 OpenWebUI model diagnostic

Date: 2026-10-05. This records model selection work after the initial T3 run. T3 remains incomplete.

## Evidence

| Model        | Run                                                                          | Single operations                                 | Composites                      | Result                                                                                                                               |
| ------------ | ---------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `qwen3.5:2b` | [Full T3 evidence](trip-command-t3-evidence-qwen3.5-2b.json)                 | 10 PASS, 2 FAIL, 1 BLOCKED                        | C1 BLOCKED; C2 and C3 FAIL      | S07 chose `move_day`; S11 generated invalid `set_visit_time`; C2 and C3 returned incomplete JSON.                                    |
| `qwen3.5:9b` | [Full T3 evidence](trip-command-t3-evidence-qwen3.5-9b.json)                 | 5 PASS, 7 provider timeouts, 1 BLOCKED            | C1 BLOCKED; C2 and C3 timed out | The existing 120-second OpenWebUI timeout was reached in 9 of 14 runnable scenarios.                                                 |
| `qwen3.5:4b` | [Partial runtime evidence](trip-command-t3-evidence-qwen3.5-4b-partial.json) | First two runnable scenarios timed out; 1 BLOCKED | C1 BLOCKED; C2 and C3 NOT RUN   | Stopped after consecutive timeouts during a period of provider saturation. This run does not establish the model's command accuracy. |

All model requests used the same TripCommandPlan generation contract. The 9b and 4b requests selected the model through the existing `/api/chat` request-level `model` field. The Test Bed runner was restored to the configured `qwen3.5:2b` model after the diagnostic; `backend/.env.local` was not changed.

The OpenWebUI adapter passes `model` and the system/user `messages` to `ollama/api/chat` with `stream: false`. The earlier `/api/chat` response discarded the upstream `done_reason`. The adapter and T3 evidence record now expose it as optional `finishReason` metadata for future runs. The historical 2b C2/C3 evidence proves incomplete JSON but cannot establish whether the upstream stopped due to a generation limit. A separate generic 2b length diagnostic timed out after 120 seconds while the provider was saturated, so it did not establish the stop reason either.

The 4b run was interrupted while S03 was in flight. Its disposable S03 trip was found by a canonical list, deleted through `HttpTripRepository`, and confirmed absent. The final canonical list contained zero `T3 Validation Trip` entries.

`GOOGLE_PLACES_API_KEY` is missing. The actual Places autocomplete endpoint returned HTTP 503 `PLACES_NOT_CONFIGURED`; S05 and C1 remain blocked. The model diagnostic made no attempt to use raw place injection or a mock source.

## Decision

No candidate replacement has passed all required T3 scenarios. Keep T3 at `T3_VERIFICATION_FAILED`. After OpenWebUI latency recovers, run a single, fresh configuration verification against the unresolved S07, S11, C2, and C3 scenarios and record `finishReason`. The authoritative Places source must also be configured before S05 and C1 can pass.
````

## frontend/src/pages/testbed/t3TripCommandRunner.ts

SHA256: `0b8453358e7eaebe6663b1293c3a104b4886d35a3cdb0c176778f2960dcd692c`; bytes: 22645.

````typescript
import {
  CHAT_LIMITS,
  type Trip,
  type TripCommandPlanOperation,
  type TripInput,
} from '@trasolve/shared';
import { HttpTripRepository } from '@/entities/trip';
import { sendChat } from '@/features/ai-chat/api/chat';
import {
  createTripCommandPlanContext,
  createTripCommandPlanPrompt,
  TRIP_COMMAND_PLAN_GENERATION_CONTRACT_VERSION,
  TRIP_COMMAND_PLAN_SYSTEM_PROMPT,
} from '@/features/map-workspace/ai-command/TripCommandPlanContext';
import {
  executePreparedTripCommandPlan,
  prepareTripCommandPlan,
} from '@/features/map-workspace/ai-command/TripCommandPlanExecutor';
import { serializeTripCommandPlanState } from '@/features/map-workspace/ai-command/TripCommandPlanFingerprint';
import { parseTripCommandPlanText } from '@/features/map-workspace/ai-command/TripCommandPlanParser';
import { TripEditController } from '@/features/map-workspace/controller/TripEditController';
import { createTripStore } from '@/features/map-workspace/store/createTripStore';

type ScenarioStatus = 'PASS' | 'FAIL' | 'BLOCKED';

type ScenarioSpec = Readonly<{
  id: string;
  request: string;
  fixture: TripInput;
  expectedOperations: readonly TripCommandPlanOperation['op'][];
  selectedPlaceNames?: readonly string[];
  assertAfter: (before: Trip, after: Trip) => readonly string[];
}>;

export type T3ScenarioEvidence = Readonly<{
  scenarioId: string;
  request: string;
  before: Trip | null;
  provider: 'openwebui';
  model: 'qwen3.5:2b';
  rawOutput: string | null;
  finishReason: string | null;
  commandSequence: readonly TripCommandPlanOperation[];
  validation: 'PASS' | 'FAIL' | 'NOT_RUN';
  preview: unknown;
  execution: 'PASS' | 'FAIL' | 'NOT_RUN';
  save: 'PASS' | 'FAIL' | 'NOT_RUN';
  reload: 'PASS' | 'FAIL' | 'NOT_RUN';
  after: Trip | null;
  intentMatch: 'PASS' | 'FAIL' | 'NOT_RUN';
  errorsFixes: readonly string[];
  latency: Readonly<{
    modelRequestMs: number | null;
    prepareMs: number | null;
    executeMs: number | null;
    saveMs: number | null;
    reloadMs: number | null;
    totalMs: number;
  }>;
  status: ScenarioStatus;
}>;

export type T3RunEvidence = Readonly<{
  contractVersion: string;
  startedAt: string;
  completedAt: string;
  records: readonly T3ScenarioEvidence[];
}>;

const PROVIDER = 'openwebui' as const;
const MODEL = 'qwen3.5:2b' as const;
const T3_EVIDENCE_STORAGE_KEY = 'trasolve:t3-trip-command-evidence';

export async function runT3TripCommandScenarios(): Promise<T3RunEvidence> {
  const startedAt = new Date().toISOString();
  const records: T3ScenarioEvidence[] = [
    blockedPlaceScenario('T3-S05', '2일차에 아사쿠사를 추가해줘.'),
    blockedPlaceScenario(
      'T3-C1',
      '2일차에 아사쿠사를 추가하고 오후 2시부터 90분 머물게 해줘.',
    ),
  ];
  persistEvidence({
    contractVersion: TRIP_COMMAND_PLAN_GENERATION_CONTRACT_VERSION,
    startedAt,
    completedAt: '',
    records,
  });

  for (const scenario of createRunnableScenarios()) {
    records.push(await runScenario(scenario));
    persistEvidence({
      contractVersion: TRIP_COMMAND_PLAN_GENERATION_CONTRACT_VERSION,
      startedAt,
      completedAt: '',
      records,
    });
  }

  const evidence = {
    contractVersion: TRIP_COMMAND_PLAN_GENERATION_CONTRACT_VERSION,
    startedAt,
    completedAt: new Date().toISOString(),
    records,
  };
  persistEvidence(evidence);
  return evidence;
}

export function readPersistedT3TripCommandEvidence(): T3RunEvidence | null {
  const value = localStorage.getItem(T3_EVIDENCE_STORAGE_KEY);
  return value ? (JSON.parse(value) as T3RunEvidence) : null;
}

export async function rerunPersistedT3TripCommandScenario(
  scenarioId: string,
): Promise<T3ScenarioEvidence> {
  const scenario = createRunnableScenarios().find(
    (candidate) => candidate.id === scenarioId,
  );
  if (!scenario) {
    throw new Error(`Unknown runnable T3 scenario: ${scenarioId}`);
  }
  const record = await runScenario(scenario);
  const current = readPersistedT3TripCommandEvidence();
  if (current) {
    persistEvidence({
      ...current,
      completedAt: new Date().toISOString(),
      records: current.records.map((candidate) =>
        candidate.scenarioId === scenarioId ? record : candidate,
      ),
    });
  }
  return record;
}

function persistEvidence(evidence: T3RunEvidence): void {
  localStorage.setItem(T3_EVIDENCE_STORAGE_KEY, JSON.stringify(evidence));
}

async function runScenario(spec: ScenarioSpec): Promise<T3ScenarioEvidence> {
  const totalStartedAt = performance.now();
  const repository = new HttpTripRepository();
  let created: Trip | null = null;
  let controller: TripEditController | null = null;
  let before: Trip | null = null;
  let rawOutput: string | null = null;
  let finishReason: string | null = null;
  let commandSequence: readonly TripCommandPlanOperation[] = [];
  let preview: unknown = null;
  let after: Trip | null = null;
  let validation: T3ScenarioEvidence['validation'] = 'NOT_RUN';
  let execution: T3ScenarioEvidence['execution'] = 'NOT_RUN';
  let save: T3ScenarioEvidence['save'] = 'NOT_RUN';
  let reload: T3ScenarioEvidence['reload'] = 'NOT_RUN';
  let intentMatch: T3ScenarioEvidence['intentMatch'] = 'NOT_RUN';
  const errorsFixes: string[] = [];
  let modelRequestMs: number | null = null;
  let prepareMs: number | null = null;
  let executeMs: number | null = null;
  let saveMs: number | null = null;
  let reloadMs: number | null = null;

  try {
    created = await repository.createTrip(spec.fixture);
    before = await repository.getTrip(created.id);
    const selectedPlaceIds = (spec.selectedPlaceNames ?? []).flatMap((name) => {
      const place = before?.days
        .flatMap((day) => day.places)
        .find((candidate) => candidate.name === name);
      return place ? [place.id] : [];
    });
    const context = await createTripCommandPlanContext(
      before,
      selectedPlaceIds,
    );
    const prompt = createTripCommandPlanPrompt(spec.request, context);
    if (
      prompt.length > CHAT_LIMITS.messageLength ||
      TRIP_COMMAND_PLAN_SYSTEM_PROMPT.length > CHAT_LIMITS.messageLength
    ) {
      throw new ScenarioFailure(
        'MODEL_GENERATION_FAILURE',
        'TripCommand prompt exceeds the chat message limit.',
      );
    }

    const modelStartedAt = performance.now();
    const response = await sendChat({
      messages: [
        { role: 'system', content: TRIP_COMMAND_PLAN_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
    });
    modelRequestMs = performance.now() - modelStartedAt;
    rawOutput = response.message.content;
    finishReason = response.finishReason ?? null;

    const parsed = parseTripCommandPlanText(rawOutput);
    if (!parsed.success) {
      throw new ScenarioFailure(
        'PARSER_SCHEMA_FAILURE',
        `${parsed.error.kind}: ${parsed.error.message}`,
      );
    }
    commandSequence = parsed.plan.operations;
    const actualOperations = commandSequence.map((operation) => operation.op);
    if (!sameSequence(actualOperations, spec.expectedOperations)) {
      throw new ScenarioFailure(
        'MODEL_GENERATION_FAILURE',
        `Expected operations ${spec.expectedOperations.join(',')} but received ${actualOperations.join(',')}.`,
      );
    }
    validation = 'PASS';

    const store = createTripStore(before);
    controller = new TripEditController(store, repository, {
      debouncedAutosave: true,
    });
    const prepareStartedAt = performance.now();
    const preparedResult = await prepareTripCommandPlan(parsed.plan, before, {
      selectedPlaceIds,
    });
    prepareMs = performance.now() - prepareStartedAt;
    if (!preparedResult.success) {
      throw new ScenarioFailure(
        'PREPARE_FAILURE',
        `${preparedResult.error.code}: ${preparedResult.error.message}`,
      );
    }
    preview = {
      operationCount: preparedResult.prepared.operationCount,
      commandCount: preparedResult.prepared.commands.length,
      diff: preparedResult.prepared.preview.diff,
      risk: preparedResult.prepared.preview.risk,
      before: preparedResult.prepared.preview.before,
      after: preparedResult.prepared.preview.after,
    };

    const canonicalBeforeExecution = await repository.getTrip(before.id);
    if (
      serializeTripCommandPlanState(store.getState().trip) !==
        serializeTripCommandPlanState(before) ||
      serializeTripCommandPlanState(canonicalBeforeExecution) !==
        serializeTripCommandPlanState(before)
    ) {
      throw new ScenarioFailure(
        'PREPARE_FAILURE',
        'Preview mutated local or canonical state.',
      );
    }

    const executeStartedAt = performance.now();
    const executed = await executePreparedTripCommandPlan(
      preparedResult.prepared,
      store.getState().trip,
      controller,
    );
    executeMs = performance.now() - executeStartedAt;
    if (!executed.success) {
      execution = 'FAIL';
      throw new ScenarioFailure(
        'EXECUTION_FAILURE',
        `${executed.error.code}: ${executed.error.message}`,
      );
    }
    execution = 'PASS';
    const localExecuted = store.getState().trip;
    const localErrors = spec.assertAfter(before, localExecuted);
    if (localErrors.length > 0) {
      throw new ScenarioFailure('EXECUTION_FAILURE', localErrors.join(' '));
    }

    const saveStartedAt = performance.now();
    const saved = await controller.save();
    saveMs = performance.now() - saveStartedAt;
    if (!saved) {
      save = 'FAIL';
      throw new ScenarioFailure(
        'SAVE_FAILURE',
        'Controller save returned false.',
      );
    }
    save = 'PASS';

    const reloadStartedAt = performance.now();
    after = await repository.getTrip(before.id);
    reloadMs = performance.now() - reloadStartedAt;
    reload = 'PASS';
    const persistedErrors = spec.assertAfter(before, after);
    if (persistedErrors.length > 0) {
      intentMatch = 'FAIL';
      throw new ScenarioFailure('RELOAD_MISMATCH', persistedErrors.join(' '));
    }
    if (
      serializeTripCommandPlanState(store.getState().trip) !==
      serializeTripCommandPlanState(after)
    ) {
      intentMatch = 'FAIL';
      throw new ScenarioFailure(
        'RELOAD_MISMATCH',
        'Local saved state differs from canonical reload.',
      );
    }
    intentMatch = 'PASS';
  } catch (cause) {
    const failure =
      cause instanceof ScenarioFailure
        ? cause
        : new ScenarioFailure(
            'PROVIDER_FAILURE',
            cause instanceof Error ? cause.message : String(cause),
          );
    errorsFixes.push(`${failure.kind}: ${failure.message}`);
  } finally {
    controller?.destroy();
    if (created) {
      try {
        await repository.deleteTrip(created.id);
      } catch (cause) {
        errorsFixes.push(
          `CLEANUP_FAILURE: ${cause instanceof Error ? cause.message : String(cause)}`,
        );
      }
    }
  }

  const passed =
    validation === 'PASS' &&
    execution === 'PASS' &&
    save === 'PASS' &&
    reload === 'PASS' &&
    intentMatch === 'PASS' &&
    errorsFixes.length === 0;
  return {
    scenarioId: spec.id,
    request: spec.request,
    before,
    provider: PROVIDER,
    model: MODEL,
    rawOutput,
    finishReason,
    commandSequence,
    validation,
    preview,
    execution,
    save,
    reload,
    after,
    intentMatch,
    errorsFixes,
    latency: {
      modelRequestMs,
      prepareMs,
      executeMs,
      saveMs,
      reloadMs,
      totalMs: performance.now() - totalStartedAt,
    },
    status: passed ? 'PASS' : 'FAIL',
  };
}

function blockedPlaceScenario(
  scenarioId: string,
  request: string,
): T3ScenarioEvidence {
  return {
    scenarioId,
    request,
    before: null,
    provider: PROVIDER,
    model: MODEL,
    rawOutput: null,
    finishReason: null,
    commandSequence: [],
    validation: 'NOT_RUN',
    preview: null,
    execution: 'NOT_RUN',
    save: 'NOT_RUN',
    reload: 'NOT_RUN',
    after: null,
    intentMatch: 'NOT_RUN',
    errorsFixes: [
      'EXTERNAL_PLACE_SOURCE_BLOCKED: GOOGLE_PLACES_API_KEY is missing.',
    ],
    latency: {
      modelRequestMs: null,
      prepareMs: null,
      executeMs: null,
      saveMs: null,
      reloadMs: null,
      totalMs: 0,
    },
    status: 'BLOCKED',
  };
}

class ScenarioFailure extends Error {
  public constructor(
    public readonly kind:
      | 'MODEL_GENERATION_FAILURE'
      | 'PARSER_SCHEMA_FAILURE'
      | 'PREPARE_FAILURE'
      | 'EXECUTION_FAILURE'
      | 'SAVE_FAILURE'
      | 'RELOAD_MISMATCH'
      | 'PROVIDER_FAILURE',
    message: string,
  ) {
    super(message);
    this.name = 'ScenarioFailure';
  }
}

function createRunnableScenarios(): readonly ScenarioSpec[] {
  return [
    {
      id: 'T3-S01',
      request: '여행 이름을 T3 검증 여행 완료로 바꿔줘.',
      fixture: baseFixture(),
      expectedOperations: ['rename_trip'],
      assertAfter: (before, after) =>
        after.title === 'T3 검증 여행 완료' &&
        after.days.length === before.days.length
          ? []
          : ['Trip title or unrelated day state does not match.'],
    },
    {
      id: 'T3-S02',
      request: '새로운 3일차를 추가해줘.',
      fixture: twoDayFixture(),
      expectedOperations: ['add_day'],
      assertAfter: (before, after) =>
        after.days.length === before.days.length + 1 &&
        Boolean(after.days[2]?.title) &&
        Boolean(after.days[2]?.id)
          ? []
          : ['Canonical third day was not added.'],
    },
    {
      id: 'T3-S03',
      request: '2일차 이름을 둘째 날로 바꿔줘.',
      fixture: twoDayFixture(),
      expectedOperations: ['rename_day'],
      assertAfter: (before, after) =>
        after.days[0]?.title === before.days[0]?.title &&
        after.days[1]?.title === '둘째 날'
          ? []
          : ['Only the target day should be renamed.'],
    },
    {
      id: 'T3-S04',
      request: '3일차를 맨 앞으로 옮겨줘.',
      fixture: threeDayFixture(),
      expectedOperations: ['move_day'],
      assertAfter: (_before, after) =>
        sameSequence(
          after.days.map((day) => day.title),
          ['3일차', '1일차', '2일차'],
        )
          ? []
          : ['Day order does not match the request.'],
    },
    {
      id: 'T3-S06',
      request: '1일차의 우에노 공원을 삭제해줘.',
      fixture: placeFixture(),
      expectedOperations: ['remove_place'],
      assertAfter: (_before, after) => {
        const names = allPlaceNames(after);
        return !names.includes('우에노 공원') && names.includes('시부야')
          ? []
          : ['Target removal or unrelated-place preservation failed.'];
      },
    },
    {
      id: 'T3-S07',
      request: '1일차의 시부야를 2일차 마지막으로 옮겨줘.',
      fixture: placeFixture(),
      expectedOperations: ['move_place'],
      assertAfter: (_before, after) => {
        const day1 = after.days[0];
        const day2 = after.days[1];
        return !day1?.places.some((place) => place.name === '시부야') &&
          day2?.places.at(-1)?.name === '시부야'
          ? []
          : ['Place was not moved to the requested final position.'];
      },
    },
    {
      id: 'T3-S08',
      request: '1일차의 시부야 이름을 시부야 스카이로 바꿔줘.',
      fixture: placeFixture(),
      expectedOperations: ['rename_place'],
      assertAfter: (_before, after) =>
        allPlaceNames(after).includes('시부야 스카이') &&
        allPlaceNames(after).includes('우에노 공원')
          ? []
          : ['Only the target place should be renamed.'],
    },
    {
      id: 'T3-S09',
      request: '1일차의 시부야 메모를 야경으로 설정해줘.',
      fixture: placeFixture(),
      expectedOperations: ['set_memo'],
      assertAfter: (_before, after) =>
        findPlaceByName(after, '시부야')?.memo === '야경'
          ? []
          : ['Memo was not persisted.'],
    },
    {
      id: 'T3-S10',
      request: '1일차의 시부야 방문 시작 시간을 오후 2시로 바꿔줘.',
      fixture: placeFixture(),
      expectedOperations: ['set_visit_time'],
      assertAfter: (_before, after) =>
        findPlaceByName(after, '시부야')?.time === '14:00'
          ? []
          : ['Visit start time was not persisted.'],
    },
    {
      id: 'T3-S11',
      request: '1일차의 시부야 방문 시간을 90분으로 바꿔줘.',
      fixture: placeFixture(),
      expectedOperations: ['set_visit_duration'],
      assertAfter: (_before, after) =>
        findPlaceByName(after, '시부야')?.visitDurationMinutes === 90
          ? []
          : ['Visit duration was not persisted.'],
    },
    {
      id: 'T3-S12',
      request: '1일차의 시부야 선호 체류 시간을 120분으로 바꿔줘.',
      fixture: placeFixture(),
      expectedOperations: ['set_preferred_duration'],
      assertAfter: (_before, after) =>
        findPlaceByName(after, '시부야')?.preferredDurationMinutes === 120
          ? []
          : ['Preferred duration was not persisted.'],
    },
    {
      id: 'T3-S13',
      request:
        '1일차의 시부야에서 도쿄 타워로 이어지는 경로를 도보 모드로 바꿔줘.',
      fixture: polylineFixture(),
      expectedOperations: ['set_polyline_mode'],
      assertAfter: (_before, after) =>
        after.days[0]?.polylines[0]?.mode === 'walking'
          ? []
          : ['Polyline mode was not persisted.'],
    },
    {
      id: 'T3-C2',
      request:
        '시부야를 1일차에서 2일차 마지막으로 옮기고 메모에 야경이라고 적어줘.',
      fixture: placeFixture(),
      expectedOperations: ['move_place', 'set_memo'],
      assertAfter: (_before, after) => {
        const day1 = after.days[0];
        const day2 = after.days[1];
        const shibuya = findPlaceByName(after, '시부야');
        return !day1?.places.some((place) => place.name === '시부야') &&
          day2?.places.at(-1)?.name === '시부야' &&
          shibuya?.memo === '야경'
          ? []
          : ['Composite move/memo result does not match.'];
      },
    },
    {
      id: 'T3-C3',
      request: '3일차를 새로 만들고 이 장소 세 개를 그쪽으로 옮겨줘.',
      fixture: selectionFixture(),
      selectedPlaceNames: ['시부야', '우에노 공원', '도쿄 타워'],
      expectedOperations: ['add_day', 'move_place', 'move_place', 'move_place'],
      assertAfter: (before, after) => {
        const newDay = after.days.find((day) => day.title === '3일차');
        const selectedNames = ['시부야', '우에노 공원', '도쿄 타워'];
        const allIds = after.days.flatMap((day) =>
          day.places.map((place) => place.id),
        );
        const originalIds = before.days.flatMap((day) =>
          day.places.map((place) => place.id),
        );
        return newDay &&
          selectedNames.every((name) =>
            newDay.places.some((place) => place.name === name),
          ) &&
          sameSet(allIds, originalIds) &&
          allIds.length === new Set(allIds).size
          ? []
          : ['Composite day creation or three-place move failed.'];
      },
    },
  ];
}

function baseFixture(): TripInput {
  return { title: 'T3 Validation Trip', days: [] };
}

function twoDayFixture(): TripInput {
  return {
    title: 'T3 Validation Trip',
    days: [fixtureDay('day-1', '1일차'), fixtureDay('day-2', '2일차')],
  };
}

function threeDayFixture(): TripInput {
  return {
    title: 'T3 Validation Trip',
    days: [
      fixtureDay('day-1', '1일차'),
      fixtureDay('day-2', '2일차'),
      fixtureDay('day-3', '3일차'),
    ],
  };
}

function placeFixture(): TripInput {
  return {
    title: 'T3 Validation Trip',
    days: [
      fixtureDay('day-1', '1일차', [
        fixturePlace('place-shibuya', '시부야', 35.6595, 139.7005),
        fixturePlace('place-ueno', '우에노 공원', 35.7148, 139.7732),
      ]),
      fixtureDay('day-2', '2일차', [
        fixturePlace('place-tower', '도쿄 타워', 35.6586, 139.7454),
      ]),
    ],
  };
}

function polylineFixture(): TripInput {
  return {
    title: 'T3 Validation Trip',
    days: [
      {
        ...fixtureDay('day-1', '1일차', [
          fixturePlace('place-shibuya', '시부야', 35.6595, 139.7005),
          fixturePlace('place-tower', '도쿄 타워', 35.6586, 139.7454),
        ]),
        polylines: [
          {
            id: 'polyline-shibuya-tower',
            fromPlaceId: 'place-shibuya',
            toPlaceId: 'place-tower',
            mode: 'straight',
          },
        ],
        layerItems: [
          { type: 'place', id: 'place-shibuya' },
          { type: 'polyline', id: 'polyline-shibuya-tower' },
          { type: 'place', id: 'place-tower' },
        ],
      },
    ],
  };
}

function selectionFixture(): TripInput {
  return {
    title: 'T3 Validation Trip',
    days: [
      fixtureDay('day-1', '1일차', [
        fixturePlace('place-shibuya', '시부야', 35.6595, 139.7005),
        fixturePlace('place-ueno', '우에노 공원', 35.7148, 139.7732),
        fixturePlace('place-tower', '도쿄 타워', 35.6586, 139.7454),
      ]),
      fixtureDay('day-2', '2일차'),
    ],
  };
}

function fixtureDay(
  id: string,
  title: string,
  places: NonNullable<TripInput['days'][number]['places']> = [],
): TripInput['days'][number] {
  return {
    id,
    title,
    color: '#2563eb',
    places,
    polylines: [],
    layerItems: places.flatMap((place) =>
      place.id ? [{ type: 'place' as const, id: place.id }] : [],
    ),
  };
}

function fixturePlace(
  id: string,
  name: string,
  lat: number,
  lng: number,
): TripInput['days'][number]['places'][number] {
  return {
    id,
    placeId: `fixture-${id}`,
    name,
    location: { lat, lng },
    time: '10:00',
    visitDurationMinutes: 60,
    preferredDurationMinutes: 60,
  };
}

function findPlaceByName(trip: Trip, name: string) {
  return trip.days
    .flatMap((day) => day.places)
    .find((place) => place.name === name);
}

function allPlaceNames(trip: Trip): string[] {
  return trip.days.flatMap((day) => day.places.map((place) => place.name));
}

function sameSequence<T>(left: readonly T[], right: readonly T[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function sameSet<T>(left: readonly T[], right: readonly T[]): boolean {
  return (
    left.length === right.length && left.every((value) => right.includes(value))
  );
}
````
