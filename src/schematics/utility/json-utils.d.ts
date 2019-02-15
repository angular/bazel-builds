/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/// <amd-module name="@angular/bazel/src/schematics/utility/json-utils" />
import { JsonAstNode, JsonAstObject, JsonValue } from '@angular-devkit/core';
import { UpdateRecorder } from '@angular-devkit/schematics';
/**
 * Replace the value of the key-value pair in the 'node' object with a different
 * 'value' and record the update using the specified 'recorder'.
 */
export declare function replacePropertyInAstObject(recorder: UpdateRecorder, node: JsonAstObject, propertyName: string, value: JsonValue, indent?: number): void;
/**
 * Remove the key-value pair with the specified 'key' in the specified 'node'
 * object and record the update using the specified 'recorder'.
 */
export declare function removeKeyValueInAstObject(recorder: UpdateRecorder, content: string, node: JsonAstObject, key: string): void;
/**
 * Returns true if the specified 'node' is a JsonAstObject, false otherwise.
 */
export declare function isJsonAstObject(node: JsonAstNode | null): node is JsonAstObject;
