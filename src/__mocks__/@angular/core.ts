export function Injectable(options?: any) {
  return function (target: any) {
    return target;
  };
}

export class NgZone {
  run(fn: Function) {
    return fn();
  }
  runOutsideAngular(fn: Function) {
    return fn();
  }
}

export interface OnDestroy {
  ngOnDestroy(): void;
}
