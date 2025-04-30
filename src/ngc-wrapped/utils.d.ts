/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 *
 * @fileoverview A set of common helpers related to ng compiler wrapper.
 */
import { CompilerHost as NgCompilerHost } from '@angular/compiler-cli';
import ts from 'typescript';
export declare const EXT: RegExp;
export declare function relativeToRootDirs(filePath: string, rootDirs: string[]): string;
/**
 * Adds support for the optional `fileNameToModuleName` operation to a given `ng.CompilerHost`.
 *
 * This is used within `ngc-wrapped` and the Bazel compilation flow, but is exported here to allow
 * for other consumers of the compiler to access this same logic. For example, the xi18n operation
 * in g3 configures its own `ng.CompilerHost` which also requires `fileNameToModuleName` to work
 * correctly.
 */
export declare function patchNgHostWithFileNameToModuleName(ngHost: NgCompilerHost, compilerOpts: ts.CompilerOptions, rootDirs: string[], workspaceName: string, compilationTargetSrc: string[], useManifestPathsAsModuleName: boolean): void;
