/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/// <amd-module name="@angular/bazel/src/schematics/utility/workspace-utils" />
import { JsonAstObject } from '@angular-devkit/core';
/**
 * Find the e2e architect node in the JSON ast.
 * The e2e application is relocated alongside the existing application.
 * This function supports looking up the e2e architect in both the new and old
 * layout.
 * See https://github.com/angular/angular-cli/pull/13780
 */
export declare function findE2eArchitect(ast: JsonAstObject, name: string): JsonAstObject | null;
