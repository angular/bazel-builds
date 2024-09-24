/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */
import * as ng from '@angular/compiler-cli';
import tscw from '@bazel/concatjs/internal/tsc_wrapped/index.js';
import ts from 'typescript';
interface BazelOptions extends tscw.BazelOptions {
    allowedInputs?: string[];
    unusedInputsListPath?: string;
}
export declare function main(args: string[]): Promise<1 | 0>;
export declare function runOneBuild(args: string[], inputs?: {
    [path: string]: string;
}): Promise<boolean>;
export declare function compile({ allDepsCompiledWithBazel, useManifestPathsAsModuleName, compilerOpts, tsHost, bazelOpts, files, inputs, expectedOuts, gatherDiagnostics, bazelHost, }: {
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
    gatherDiagnostics?: (program: ng.Program) => readonly ts.Diagnostic[];
    bazelHost?: tscw.CompilerHost;
}): {
    diagnostics: readonly ts.Diagnostic[];
    program: ng.Program | undefined;
};
/**
 * Writes a collection of unused input files and directories which can be
 * consumed by bazel to avoid triggering rebuilds if only unused inputs are
 * changed.
 *
 * See https://bazel.build/contribute/codebase#input-discovery
 */
export declare function maybeWriteUnusedInputsList(program: ts.Program, rootDir: string, bazelOpts: BazelOptions): void;
/**
 * @deprecated
 * Kept here just for compatibility with 1P tools. To be removed soon after 1P update.
 */
export declare function patchNgHostWithFileNameToModuleName(ngHost: ng.CompilerHost, compilerOpts: ng.CompilerOptions, bazelOpts: BazelOptions, rootDirs: string[], useManifestPathsAsModuleName: boolean): void;
export {};
