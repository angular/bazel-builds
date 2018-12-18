/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 *
 * @fileoverview Bazel builder
 */
/// <amd-module name="@angular/bazel/src/builders" />
import { BuildEvent, Builder, BuilderConfiguration, BuilderContext } from '@angular-devkit/architect';
import { Observable } from 'rxjs';
import { Schema } from './schema';
declare class BazelBuilder implements Builder<Schema> {
    private context;
    constructor(context: BuilderContext);
    run(builderConfig: BuilderConfiguration<Partial<Schema>>): Observable<BuildEvent>;
}
export default BazelBuilder;
