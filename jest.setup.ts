import "@testing-library/jest-dom";
import nodeFetch, {
  Headers as NodeFetchHeaders,
  Request as NodeFetchRequest,
  Response as NodeFetchResponse,
} from "node-fetch";

// Jest의 jsdom 환경에는 Node 런타임의 Fetch API가 전달되지 않는다. Firebase Auth는
// 모듈 초기화 시 이 표준 객체들을 참조하므로 테스트 런타임에만 동일한 API를 제공한다.
if (typeof globalThis.fetch !== 'function') {
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value: nodeFetch,
    writable: true,
  });
}

if (typeof globalThis.Headers !== "function") {
  Object.defineProperty(globalThis, "Headers", {
    configurable: true,
    value: NodeFetchHeaders,
    writable: true,
  });
}

if (typeof globalThis.Request !== "function") {
  Object.defineProperty(globalThis, "Request", {
    configurable: true,
    value: NodeFetchRequest,
    writable: true,
  });
}

if (typeof globalThis.Response !== "function") {
  Object.defineProperty(globalThis, "Response", {
    configurable: true,
    value: NodeFetchResponse,
    writable: true,
  });
}
