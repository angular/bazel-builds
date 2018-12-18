/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/// <amd-module name="@angular/bazel/src/builders/bazel" />
import { Observable } from 'rxjs';
export declare type Executable = 'bazel' | 'ibazel';
export declare type Command = 'build' | 'test' | 'run' | 'coverage' | 'query';
export declare function runBazel(projectDir: string, executable: Executable, command: Command, workspaceTarget: string, flags: string[]): Observable<void>;
export declare function checkInstallation(executable: Executable, projectDir: string): boolean;
