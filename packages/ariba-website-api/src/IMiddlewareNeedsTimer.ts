export interface IMiddlewareNeedsTimer {
    timerEvent(): void;
    timerInterval: number;
}
