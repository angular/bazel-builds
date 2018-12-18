/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/// <amd-module name="@angular/bazel/protractor-utils" />
export declare function isTcpPortFree(port: number): Promise<boolean>;
export declare function isTcpPortBound(port: number): Promise<boolean>;
export declare function findFreeTcpPort(): Promise<number>;
export interface OnPrepareConfig {
    workspace: string;
    server: string;
}
export declare function waitForServer(port: number, timeout: number): Promise<boolean>;
export interface ServerSpec {
    port: number;
}
export declare function runServer(workspace: string, binary: string, portFlag: string, args: string[], timeout?: number): Promise<ServerSpec>;
