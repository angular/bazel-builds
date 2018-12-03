/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 *
 * @fileoverview Bazel bundle builder
 */
/// <amd-module name="angular/packages/bazel/src/builders/index" />
import { BuildEvent, Builder as BuilderInterface, BuilderConfiguration, BuilderContext } from '@angular-devkit/architect';
import { Observable } from 'rxjs';
import { Schema } from './schema';
export declare class Builder implements BuilderInterface<Schema> {
    private context;
    constructor(context: BuilderContext);
    run(builderConfig: BuilderConfiguration<Partial<Schema>>): Observable<BuildEvent>;
}
