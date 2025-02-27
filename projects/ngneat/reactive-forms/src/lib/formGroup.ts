import { FormGroup as NgFormGroup } from '@angular/forms';
import { isObservable, Observable, Subject, Subscription } from 'rxjs';
import { distinctUntilChanged, switchMap, take, tap } from 'rxjs/operators';
import {
  controlDisabled$,
  controlDisabledWhile,
  controlEnabled$,
  controlEnabledWhile,
  controlErrorChanges$,
  controlStatusChanges$,
  controlValueChanges$,
  disableControl,
  enableControl,
  handleFormArrays,
  hasErrorAndDirty,
  hasErrorAndTouched,
  markAllDirty,
  mergeControlValidators,
  persistValue$,
  selectControlValue$,
  validateControlOn
} from './control-actions';
import { LocalStorageManager } from './localStorageManager';
import { PersistManager } from './persistManager';
import {
  AbstractControl,
  AsyncValidator,
  AsyncValidatorFn,
  ControlEventOptions,
  ControlFactoryMap,
  ControlOptions,
  ControlState,
  EmitEvent,
  ExtractStrings,
  Obj,
  OnlySelf,
  Validator,
  ValidatorOrOpts,
  ControlsValue,
  AbstractControlsOf,
  PersistOptions,
  ValidatorFn,
  DeepPartial,
  UpdateValueAndValidityOptions
} from './types';
import {
  coerceArray,
  mergeErrors,
  removeError,
  wrapIntoObservable,
  superAsyncValidator,
  superValidator
} from './utils';
import { FormArray } from './formArray';

export class FormGroup<T extends Obj = any, E extends object = any> extends NgFormGroup {
  readonly value: ControlsValue<T>;
  readonly errors: E | null;
  readonly valueChanges: Observable<ControlsValue<T>>;
  readonly status: ControlState;
  readonly statusChanges: Observable<ControlState>;

  private touchChanges = new Subject<boolean>();
  private dirtyChanges = new Subject<boolean>();
  private errorsSubject = new Subject<Partial<E>>();

  readonly touch$ = this.touchChanges.asObservable().pipe(distinctUntilChanged());
  readonly dirty$ = this.dirtyChanges.asObservable().pipe(distinctUntilChanged());

  readonly value$ = controlValueChanges$<ControlsValue<T>>(this);
  readonly disabled$: Observable<boolean> = controlDisabled$<ControlsValue<T>>(this);
  readonly enabled$: Observable<boolean> = controlEnabled$<ControlsValue<T>>(this);
  readonly status$: Observable<ControlState> = controlStatusChanges$<ControlsValue<T>>(this);
  readonly errors$ = controlErrorChanges$<E>(this, this.errorsSubject.asObservable());

  get asyncValidator(): AsyncValidatorFn<T> | null {
    return superAsyncValidator.get.call(this);
  }
  set asyncValidator(asyncValidator: AsyncValidatorFn<T> | null) {
    superAsyncValidator.set.call(this, asyncValidator);
  }

  get validator(): ValidatorFn<T> | null {
    return superValidator.get.call(this);
  }
  set validator(validator: ValidatorFn<T> | null) {
    superValidator.set.call(this, validator);
  }

  constructor(
    public controls: AbstractControlsOf<T>,
    validatorOrOpts?: ValidatorOrOpts,
    asyncValidator?: AsyncValidator
  ) {
    super(controls, validatorOrOpts, asyncValidator);
  }

  select<R>(mapFn: (state: ControlsValue<T>) => R): Observable<R> {
    return selectControlValue$(this, mapFn);
  }

  getRawValue(): ControlsValue<T> {
    return super.getRawValue();
  }

  get<K1 extends keyof ControlsValue<T>>(path?: [K1]): AbstractControlsOf<T>[K1];
  get<
    K1 extends keyof ControlsValue<T>,
    K2 extends AbstractControlsOf<T>[K1] extends FormGroup | FormArray
      ? keyof AbstractControlsOf<T>[K1]['controls']
      : never
  >(
    path?: [K1, K2]
  ): AbstractControlsOf<T>[K1] extends FormGroup | FormArray ? AbstractControlsOf<T>[K1]['controls'][K2] : never;
  get<K1 extends keyof ControlsValue<T>, K2 extends keyof ControlsValue<T>[K1]>(
    path?: [K1, K2]
  ): AbstractControl<ControlsValue<T>[K1][K2]>;
  get<
    K1 extends keyof ControlsValue<T>,
    K2 extends keyof ControlsValue<T>[K1],
    K3 extends keyof ControlsValue<T>[K1][K2]
  >(path?: [K1, K2, K3]): AbstractControl<ControlsValue<T>[K1][K2][K3]>;
  get(path?: Array<string | number> | string): AbstractControl;
  get(path: Array<string | number> | string) {
    return super.get(path);
  }

  getControl<P1 extends keyof ControlsValue<T>>(path?: P1): AbstractControlsOf<T>[P1];
  getControl<
    P1 extends keyof ControlsValue<T>,
    P2 extends AbstractControlsOf<T>[P1] extends FormGroup | FormArray
      ? keyof AbstractControlsOf<T>[P1]['controls']
      : never
  >(
    prop1: P1,
    prop2: P2
  ): AbstractControlsOf<T>[P1] extends FormGroup | FormArray ? AbstractControlsOf<T>[P1]['controls'][P2] : never;
  getControl<P1 extends keyof ControlsValue<T>, P2 extends keyof ControlsValue<T>[P1]>(
    prop1: P1,
    prop2: P2
  ): AbstractControl<ControlsValue<T>[P1][P2]>;
  getControl<
    P1 extends keyof ControlsValue<T>,
    P2 extends keyof ControlsValue<T>[P1],
    P3 extends keyof ControlsValue<T>[P1][P2]
  >(prop1: P1, prop2: P2, prop3: P3): AbstractControl<ControlsValue<T>[P1][P2][P3]>;
  getControl(path?: string): AbstractControl;
  getControl(...names: Array<string | number>): AbstractControl<any> {
    return this.get(names);
  }

  addControl<K extends ExtractStrings<T>>(name: K, control: AbstractControlsOf<T>[K]): void {
    super.addControl(name, control);
  }

  removeControl(name: ExtractStrings<T>): void {
    super.removeControl(name);
  }

  contains(controlName: ExtractStrings<T>): boolean {
    return super.contains(controlName);
  }

  setControl<K extends ExtractStrings<T>>(name: K, control: AbstractControlsOf<T>[K]): void {
    super.setControl(name, control);
  }

  setValue(valueOrObservable: Observable<ControlsValue<T>>, options?: ControlEventOptions): Subscription;
  setValue(valueOrObservable: ControlsValue<T>, options?: ControlEventOptions): void;
  setValue(valueOrObservable: any, options?: ControlEventOptions): any {
    if (isObservable(valueOrObservable)) {
      return valueOrObservable.subscribe(value => super.setValue(value, options));
    }

    super.setValue(valueOrObservable, options);
  }

  patchValue(valueOrObservable: Observable<DeepPartial<ControlsValue<T>>>, options?: ControlEventOptions): Subscription;
  patchValue(valueOrObservable: DeepPartial<ControlsValue<T>>, options?: ControlEventOptions): void;
  patchValue(valueOrObservable: any, options?: ControlEventOptions): Subscription | void {
    if (isObservable(valueOrObservable)) {
      return valueOrObservable.subscribe(value => super.patchValue(value, options));
    }

    super.patchValue(valueOrObservable, options);
  }

  disabledWhile(observable: Observable<boolean>, options?: ControlOptions) {
    return controlDisabledWhile(this, observable, options);
  }

  enabledWhile(observable: Observable<boolean>, options?: ControlOptions) {
    return controlEnabledWhile(this, observable, options);
  }

  mergeValidators(validators: Validator, options?: UpdateValueAndValidityOptions) {
    mergeControlValidators(this, validators, options);
  }

  mergeAsyncValidators(validators: AsyncValidator, options?: UpdateValueAndValidityOptions) {
    this.setAsyncValidators([this.asyncValidator, ...coerceArray(validators)]);
    this.updateValueAndValidity(options);
  }

  markAsTouched(opts?: OnlySelf): void {
    super.markAsTouched(opts);
    this.touchChanges.next(true);
  }

  markAsUntouched(opts?: OnlySelf): void {
    super.markAsUntouched(opts);
    this.touchChanges.next(false);
  }

  markAsPristine(opts?: OnlySelf): void {
    super.markAsPristine(opts);
    this.dirtyChanges.next(false);
  }

  markAsDirty(opts?: OnlySelf): void {
    super.markAsDirty(opts);
    this.dirtyChanges.next(true);
  }

  markAllAsDirty(): void {
    markAllDirty(this);
  }

  reset(formState?: DeepPartial<ControlsValue<T>>, options?: ControlEventOptions): void {
    super.reset(formState, options);
  }

  setValidators(newValidator: Validator, options?: UpdateValueAndValidityOptions): void {
    super.setValidators(newValidator);
    super.updateValueAndValidity(options);
  }

  setAsyncValidators(newValidator: AsyncValidator, options?: UpdateValueAndValidityOptions): void {
    super.setAsyncValidators(newValidator);
    super.updateValueAndValidity(options);
  }

  validateOn(observableValidation: Observable<null | object>) {
    return validateControlOn(this, observableValidation);
  }

  hasError<K1 extends keyof ControlsValue<T>>(errorCode: ExtractStrings<E>, path?: [K1]): boolean;
  hasError<K1 extends keyof ControlsValue<T>, K2 extends keyof ControlsValue<T>[K1]>(
    errorCode: ExtractStrings<E>,
    path?: [K1, K2]
  ): boolean;
  hasError<
    K1 extends keyof ControlsValue<T>,
    K2 extends keyof ControlsValue<T>[K1],
    K3 extends keyof ControlsValue<T>[K1][K2]
  >(errorCode: ExtractStrings<E>, path?: [K1, K2, K3]): boolean;
  hasError(errorCode: ExtractStrings<E>, path?: string): boolean;
  hasError(errorCode: ExtractStrings<E>, path?: any): boolean {
    return super.hasError(errorCode, path);
  }

  setErrors(errors: Partial<E> | null, opts: EmitEvent = {}) {
    this.errorsSubject.next(errors);
    return super.setErrors(errors, opts);
  }

  mergeErrors(errors: Partial<E>, opts: EmitEvent = {}): void {
    this.setErrors(mergeErrors<E>(this.errors, errors), opts);
  }

  removeError(key: keyof E, opts: EmitEvent = {}): void {
    this.setErrors(removeError<E>(this.errors, key), opts);
  }

  getError<K extends keyof E, K1 extends keyof ControlsValue<T>>(errorCode: K, path?: [K1]): E[K] | null;
  getError<K extends keyof E, K1 extends keyof ControlsValue<T>, K2 extends keyof ControlsValue<T>[K1]>(
    errorCode: K,
    path?: [K1, K2]
  ): E[K] | null;
  getError<
    K extends keyof E,
    K1 extends keyof ControlsValue<T>,
    K2 extends keyof ControlsValue<T>[K1],
    K3 extends keyof ControlsValue<T>[K1][K2]
  >(errorCode: K, path?: [K1, K2, K3]): E[K] | null;
  getError<K extends keyof E>(errorCode: K, path?: string): E[K] | null;
  getError<K extends keyof E>(errorCode: K, path?: any): E[K] | null {
    return super.getError(errorCode as any, path) as E[K] | null;
  }

  hasErrorAndTouched<P1 extends keyof ControlsValue<T>>(error: ExtractStrings<E>, prop1?: P1): boolean;
  hasErrorAndTouched<P1 extends keyof ControlsValue<T>, P2 extends keyof ControlsValue<T>[P1]>(
    error: ExtractStrings<E>,
    prop1?: P1,
    prop2?: P2
  ): boolean;
  hasErrorAndTouched<
    P1 extends keyof ControlsValue<T>,
    P2 extends keyof ControlsValue<T>[P1],
    P3 extends keyof ControlsValue<T>[P1][P2]
  >(error: ExtractStrings<E>, prop1?: P1, prop2?: P2, prop3?: P3): boolean;
  hasErrorAndTouched<
    P1 extends keyof ControlsValue<T>,
    P2 extends keyof ControlsValue<T>[P1],
    P3 extends keyof ControlsValue<T>[P1][P2],
    P4 extends keyof ControlsValue<T>[P1][P2][P3]
  >(error: ExtractStrings<E>, prop1?: P1, prop2?: P2, prop3?: P3, prop4?: P4): boolean;
  hasErrorAndTouched(error: any, ...path: any): boolean {
    return hasErrorAndTouched(this, error, ...path);
  }

  hasErrorAndDirty<P1 extends keyof ControlsValue<T>>(error: ExtractStrings<E>, prop1?: P1): boolean;
  hasErrorAndDirty<P1 extends keyof ControlsValue<T>, P2 extends keyof ControlsValue<T>[P1]>(
    error: ExtractStrings<E>,
    prop1?: P1,
    prop2?: P2
  ): boolean;
  hasErrorAndDirty<
    P1 extends keyof ControlsValue<T>,
    P2 extends keyof ControlsValue<T>[P1],
    P3 extends keyof ControlsValue<T>[P1][P2]
  >(error: ExtractStrings<E>, prop1?: P1, prop2?: P2, prop3?: P3): boolean;
  hasErrorAndDirty<
    P1 extends keyof ControlsValue<T>,
    P2 extends keyof ControlsValue<T>[P1],
    P3 extends keyof ControlsValue<T>[P1][P2],
    P4 extends keyof ControlsValue<T>[P1][P2][P3]
  >(error: ExtractStrings<E>, prop1?: P1, prop2?: P2, prop3?: P3, prop4?: P4): boolean;
  hasErrorAndDirty(error: any, ...path: any): boolean {
    return hasErrorAndDirty(this, error, ...path);
  }

  setEnable(enable = true, opts?: ControlEventOptions) {
    enableControl(this, enable, opts);
  }

  setDisable(disable = true, opts?: ControlEventOptions) {
    disableControl(this, disable, opts);
  }

  persist(
    key: string,
    { debounceTime, manager, arrControlFactory, persistDisabledControls }: PersistOptions<T>
  ): Observable<T> {
    const persistManager = manager || new LocalStorageManager();
    return this.restore(key, persistManager, arrControlFactory).pipe(
      switchMap(() =>
        persistValue$(this, key, {
          debounceTime: debounceTime || 250,
          manager: persistManager,
          persistDisabledControls
        })
      )
    );
  }

  private restore(key: string, manager: PersistManager<T>, arrControlFactory: ControlFactoryMap<T>): Observable<T> {
    return wrapIntoObservable(manager.getValue(key)).pipe(
      take(1),
      tap(value => {
        if (!value) return;
        handleFormArrays(this, value, arrControlFactory);
        this.patchValue(value, { emitEvent: false });
      })
    );
  }
}
