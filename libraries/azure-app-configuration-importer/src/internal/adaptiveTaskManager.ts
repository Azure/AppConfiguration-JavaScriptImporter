// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { BehaviorSubject } from "rxjs";
import { ImportProgress } from "../models";
import { RestError } from "@azure/core-rest-pipeline";

/** @internal */
export class AdaptiveTaskManager<T> {
  private end = false;
  private currentMax = 1;
  private limitation = 50;
  private finishedCount = 0;
  private throttledTasks: IFunction<Promise<T>>[] = [];
  private runningTasks: Map<Promise<T>, IFunction<Promise<T>>> = new Map<
    Promise<T>,
    IFunction<Promise<T>>
  >();
  private taskWrapper: IFunction<IFunction<Promise<T>> | undefined>;
  private observable: BehaviorSubject<number>;
  private importProgress: ImportProgress;

  constructor(fn: IFunction<IFunction<Promise<T>> | undefined>, size: number) {
    this.taskWrapper = fn;
    this.observable = new BehaviorSubject(0);
    this.importProgress = {
      importCount: size,
      successCount: 0
    };
  }

  public async Start(callback?: (result: ImportProgress) => void) {
    return new Promise((resolve, reject) => {
      this.observable.subscribe((value: any) => {
        if (this.end && this.throttledTasks.length == 0) {
          if (this.runningTasks.size == 0) resolve(this.finishedCount);
          return;
        }
        while (this.runningTasks.size < this.currentMax) {
          const task: IFunction<Promise<T>> | undefined = this.throttledTasks.length > 0 ? this.throttledTasks.pop() : this.taskWrapper();

          if (!task) {
            this.end = true;
            this.observable.next(++value);
            return;
          }
          const runningPromise = task();
          runningPromise.then((value: any): void => {
            if (value) {
              this.importProgress.successCount = ++this.finishedCount;
              // If import can complete successfully and it didn't hit the limitation, increase currentMax.
              if (this.currentMax < this.limitation && this.runningTasks.size <= this.currentMax) this.currentMax++;
            }
          })
            .catch((reason) => {
              if ((reason as RestError).statusCode === 429) {
                // Once have any request be throttled, relegate the queue max size to 1, and push it into throttled collection.
                this.currentMax = 1;
                this.throttledTasks.push(this.runningTasks.get(runningPromise) as IFunction<Promise<T>>);
              }
              else {
                reject(reason);
              }
            })
            .finally((): void => {
              // remove the promise from the running collection, no matter it's success or not
              if (this.runningTasks.has(runningPromise)) {
                this.runningTasks.delete(runningPromise);
              }
              if (callback) callback(this.importProgress);
              this.observable.next(++value); // trigger next round
            });
          this.runningTasks.set(runningPromise, task);
        }
      });
    });
  }
}

/** @internal */
export interface IFunction<T> {
  (): T;
}
