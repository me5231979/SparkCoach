// Messages between the side panel, the content script and the service worker. All of it stays in the browser.
import type { ScreenStep } from "@spark/core";

export type PanelMsg =
  | { t: "start"; processId: string; department?: string }
  | { t: "confirm" }            // "I did it" / checkpoint / offline confirm
  | { t: "pick"; n: number }    // answer to the current question
  | { t: "next" }               // continue after seeing an answer
  | { t: "askHelp" }
  | { t: "lessHelp" }
  | { t: "exit" };

export type ContentMsg =
  | { t: "hello" }
  | { t: "passed"; stepId: string }
  | { t: "click"; stepId: string; isTarget: boolean; mistake: number }
  | { t: "target"; stepId: string; found: boolean; strategy?: string };

/** What the worker tells the run's tab: which step to watch, and whether to spotlight it. Null = do nothing. */
export type TabView = { runId: string; processId: string; systems: string[]; index: number; step: ScreenStep; spotlight: boolean; label: string } | null;
export type WorkerMsg = { t: "view"; view: TabView };

export type Msg = PanelMsg | ContentMsg;
export const send = <R = unknown>(msg: Msg): Promise<R> =>
  chrome.runtime.sendMessage(msg).catch(() => undefined) as Promise<R>;
