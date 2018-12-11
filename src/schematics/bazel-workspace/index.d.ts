/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 *
 * @fileoverview Schematics for bazel-workspace
 */
/// <amd-module name="angular/packages/bazel/src/schematics/bazel-workspace/index" />
import { Rule } from '@angular-devkit/schematics';
import { Schema as BazelWorkspaceOptions } from './schema';
/**
 * Clean the version string and return version in the form "1.2.3". Return
 * null if version string is invalid. This is similar to semver.clean() but
 * takes characters like '^' and '~' into account.
 */
export declare function clean(version: string): string | null;
export default function (options: BazelWorkspaceOptions): Rule;
