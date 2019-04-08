/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/// <amd-module name="@angular/bazel/src/builders/bazel" />
import { Path } from '@angular-devkit/core';
import { Host } from '@angular-devkit/core/src/virtual-fs/host';
export declare type Executable = 'bazel' | 'ibazel';
export declare type Command = 'build' | 'test' | 'run' | 'coverage' | 'query';
/**
 * Spawn the Bazel process. Trap SINGINT to make sure Bazel process is killed.
 */
export declare function runBazel(projectDir: Path, binary: string, command: Command, workspaceTarget: string, flags: string[]): Promise<{}>;
/**
 * Resolves the path to `@bazel/bazel` or `@bazel/ibazel`.
 */
export declare function checkInstallation(name: Executable, projectDir: Path): string;
/**
 * Returns the absolute path to the template directory in `@angular/bazel`.
 */
export declare function getTemplateDir(host: Host, root: Path): Promise<Path>;
/**
 * Copy Bazel files (WORKSPACE, BUILD.bazel, etc) from the template directory to
 * the project `root` directory, and return the absolute paths of the files
 * copied, so that they can be deleted later.
 * Existing files in `root` will not be replaced.
 */
export declare function copyBazelFiles(host: Host, root: Path, templateDir: Path): Promise<Path[]>;
/**
 * Delete the specified 'files' and return a promise that always resolves.
 */
export declare function deleteBazelFiles(host: Host, files: Path[]): Promise<void[]>;
