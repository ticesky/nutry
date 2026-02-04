import * as babel from '@babel/core';
import { isComponentDeclaration } from './utils.js';


function addReactDisplayName(api: typeof babel): babel.PluginObj {
    const { types } = api;

    return {
        visitor: {
            FunctionDeclaration(declaration) {
                if (isComponentDeclaration(declaration)) {
                    const componentName = declaration.node.id?.name ?? '';
                    if (componentName) {
                        const assignDisplayName = types.expressionStatement(
                            types.assignmentExpression(
                                '=',
                                types.memberExpression(
                                    types.identifier(componentName),
                                    types.identifier('displayName')
                                ),
                                types.stringLiteral(componentName)
                            )
                        );
                        declaration.insertAfter(assignDisplayName);
                    }
                }
            },
        },
    };
}

export default addReactDisplayName
