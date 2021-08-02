/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/// <amd-module name="@angular/bazel" />
import * as ng from '@angular/compiler-cli';
import { BazelOptions, CompilerHost } from '@bazel/typescript';
import * as ts from 'typescript';
export declare function main(args: any): 1 | 0;
export declare function runOneBuild(args: string[], inputs?: {
    [path: string]: string;
}): boolean;
export declare function relativeToRootDirs(filePath: string, rootDirs: string[]): string;
export declare function compile({ allDepsCompiledWithBazel, useManifestPathsAsModuleName, compilerOpts, tsHost, bazelOpts, files, inputs, expectedOuts, gatherDiagnostics, bazelHost }: {
    allDepsCompiledWithBazel?: boolean;
    useManifestPathsAsModuleName?: boolean;
    compilerOpts: ng.CompilerOptions;
    tsHost: ts.CompilerHost;
    inputs?: {
        [path: string]: string;
    };
    bazelOpts: BazelOptions;
    files: string[];
    expectedOuts: string[];
    gatherDiagnostics?: (program: ng.Program) => ng.Diagnostics;
    bazelHost?: CompilerHost;
}): {
    diagnostics: ng.Diagnostics;
    program: ng.Program;
};
/**
 * Adds support for the optional `fileNameToModuleName` operation to a given `ng.CompilerHost`.
 *
 * This is used within `ngc-wrapped` and the Bazel compilation flow, but is exported here to allow
 * for other consumers of the compiler to access this same logic. For example, the xi18n operation
 * in g3 configures its own `ng.CompilerHost` which also requires `fileNameToModuleName` to work
 * correctly.
 */
export declare function patchNgHostWithFileNameToModuleName(ngHost: ng.CompilerHost, compilerOpts: ng.CompilerOptions, bazelOpts: BazelOptions, useManifestPathsAsModuleName: boolean): void;
