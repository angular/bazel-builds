/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/// <amd-module name="@angular/bazel" />
import * as ng from '@angular/compiler-cli';
import { BazelOptions, CompilerHost as BazelHost, FileLoader } from '@bazel/typescript';
import * as ts from 'typescript';
export declare function main(args: any): 1 | 0;
export declare function runOneBuild(args: string[], inputs?: {
    [path: string]: string;
}): boolean;
export declare function relativeToRootDirs(filePath: string, rootDirs: string[]): string;
export declare function compile({ allDepsCompiledWithBazel, compilerOpts, tsHost, bazelOpts, files, inputs, expectedOuts, gatherDiagnostics, bazelHost, }: {
    allDepsCompiledWithBazel?: boolean;
    compilerOpts: ng.CompilerOptions;
    tsHost: ts.CompilerHost;
    inputs?: {
        [path: string]: string;
    };
    bazelOpts: BazelOptions;
    files: string[];
    expectedOuts: string[];
    gatherDiagnostics?: (program: ng.Program) => ng.Diagnostics;
    bazelHost?: BazelHost;
}): {
    diagnostics: ng.Diagnostics;
    program: ng.Program;
};
/** A module resolver for handling generated files in Bazel. */
export declare function generatedFileModuleResolver(moduleName: string, containingFile: string, compilerOptions: ts.CompilerOptions, host: ts.ModuleResolutionHost): ts.ResolvedModuleWithFailedLookupLocations;
/** Creates a {@link FileLoader} to cache Bazel inputs.*/
export declare function createFileLoader(inputs: {
    [key: string]: string;
} | undefined, bazelOpts: BazelOptions): FileLoader;
