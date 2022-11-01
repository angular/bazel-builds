/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/// <amd-module name="@angular/bazel" />
import { BazelOptions as ExternalBazelOptions, CompilerHost } from '@bazel/concatjs/internal/tsc_wrapped';
import type { CompilerHost as NgCompilerHost, Program, CompilerOptions } from '@angular/compiler-cli';
import ts from 'typescript';
declare type CompilerCliModule = typeof import('@angular/compiler-cli') & typeof import('@angular/compiler-cli/private/bazel');
interface BazelOptions extends ExternalBazelOptions {
    allowedInputs?: string[];
    unusedInputsListPath?: string;
}
export declare function main(args: string[]): Promise<1 | 0>;
export declare function runOneBuild(args: string[], inputs?: {
    [path: string]: string;
}): Promise<boolean>;
export declare function relativeToRootDirs(filePath: string, rootDirs: string[]): string;
export declare function compile({ allDepsCompiledWithBazel, useManifestPathsAsModuleName, compilerOpts, tsHost, bazelOpts, files, inputs, expectedOuts, gatherDiagnostics, bazelHost, ng, }: {
    allDepsCompiledWithBazel?: boolean;
    useManifestPathsAsModuleName?: boolean;
    compilerOpts: CompilerOptions;
    tsHost: ts.CompilerHost;
    inputs?: {
        [path: string]: string;
    };
    bazelOpts: BazelOptions;
    files: string[];
    expectedOuts: string[];
    gatherDiagnostics?: (program: Program) => readonly ts.Diagnostic[];
    bazelHost?: CompilerHost;
    ng: CompilerCliModule;
}): {
    diagnostics: readonly ts.Diagnostic[];
    program: Program | undefined;
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
 * Adds support for the optional `fileNameToModuleName` operation to a given `ng.CompilerHost`.
 *
 * This is used within `ngc-wrapped` and the Bazel compilation flow, but is exported here to allow
 * for other consumers of the compiler to access this same logic. For example, the xi18n operation
 * in g3 configures its own `ng.CompilerHost` which also requires `fileNameToModuleName` to work
 * correctly.
 */
export declare function patchNgHostWithFileNameToModuleName(ngHost: NgCompilerHost, compilerOpts: CompilerOptions, bazelOpts: BazelOptions, rootDirs: string[], useManifestPathsAsModuleName: boolean): void;
export {};
