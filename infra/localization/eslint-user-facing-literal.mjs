const USER_FACING_ATTRIBUTES = new Set([
  'alt',
  'aria-description',
  'aria-label',
  'closeLabel',
  'description',
  'emptyText',
  'helperText',
  'label',
  'message',
  'placeholder',
  'rangeLabel',
  'subtitle',
  'title',
  'tooltip',
  'triggerLabel',
]);

const USER_FACING_CALLS = new Set([
  'alert',
  'confirm',
  'setError',
  'showError',
  'showMessage',
  'toast',
]);

const LOCALIZATION_KEY_PATTERN =
  /^[A-Za-z][A-Za-z0-9-]*:[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/u;

const NON_USER_FACING_FORMATTERS = new Set([
  'formatDateTimeLocalValue',
  'formatLocalDateTime',
]);

function normalize(value) {
  return value.replace(/\s+/gu, ' ').trim();
}

function hasVisibleText(value) {
  return normalize(value).length > 0;
}

function hasVisibleWord(value) {
  return /[\p{L}\p{N}]/u.test(normalize(value));
}

function isStaticStringLiteral(node) {
  return (
    node?.type === 'StringLiteral' ||
    (node?.type === 'Literal' && typeof node.value === 'string')
  );
}

function getStaticStringValue(node) {
  return isStaticStringLiteral(node) ? node.value : null;
}

function getJsxElementName(node) {
  const name = node.parent?.name;
  return name?.type === 'JSXIdentifier' ? name.name : '';
}

function isUserFacingAttribute(node) {
  const name = node.name?.name;
  if (typeof name !== 'string') {
    return false;
  }
  if (USER_FACING_ATTRIBUTES.has(name)) {
    return true;
  }
  return name === 'value' && /^[A-Z]/u.test(getJsxElementName(node));
}

function isClassificationCall(node) {
  return (
    node.type === 'CallExpression' &&
    node.callee.type === 'Identifier' &&
    (node.callee.name === 'L' || node.callee.name === 'NL')
  );
}

function getCalledName(node) {
  if (node.callee.type === 'Identifier') {
    return node.callee.name;
  }
  if (
    node.callee.type === 'MemberExpression' &&
    !node.callee.computed &&
    node.callee.property.type === 'Identifier'
  ) {
    if (
      node.callee.object.type === 'Identifier' &&
      node.callee.object.name === 'window'
    ) {
      return node.callee.property.name;
    }
    if (
      node.callee.object.type === 'Identifier' &&
      node.callee.object.name === 'toast'
    ) {
      return 'toast';
    }
  }
  return '';
}

function unwrapExpression(node) {
  if (
    node?.type === 'TSAsExpression' ||
    node?.type === 'TSTypeAssertion' ||
    node?.type === 'TSNonNullExpression'
  ) {
    return unwrapExpression(node.expression);
  }
  return node;
}

function containsStaticText(node) {
  const expression = unwrapExpression(node);
  if (!expression) {
    return false;
  }
  if (isStaticStringLiteral(expression)) {
    return hasVisibleWord(expression.value);
  }
  if (expression.type === 'TemplateLiteral') {
    return expression.quasis.some((quasi) =>
      hasVisibleWord(quasi.value.cooked ?? quasi.value.raw),
    );
  }
  if (expression.type === 'BinaryExpression' && expression.operator === '+') {
    return (
      containsStaticText(expression.left) ||
      containsStaticText(expression.right)
    );
  }
  return false;
}

function getEnclosingFunctionName(node) {
  let current = node.parent;
  while (current) {
    if (
      current.type === 'FunctionDeclaration' ||
      current.type === 'FunctionExpression'
    ) {
      if (current.id?.type === 'Identifier') {
        return current.id.name;
      }
      if (
        current.parent?.type === 'VariableDeclarator' &&
        current.parent.id.type === 'Identifier'
      ) {
        return current.parent.id.name;
      }
      return '';
    }
    if (current.type === 'ArrowFunctionExpression') {
      if (
        current.parent?.type === 'VariableDeclarator' &&
        current.parent.id.type === 'Identifier'
      ) {
        return current.parent.id.name;
      }
      return '';
    }
    current = current.parent;
  }
  return '';
}

function reportUserFacingExpression(context, originalNode) {
  const node = unwrapExpression(originalNode);
  if (!node || isClassificationCall(node)) {
    return;
  }
  if (isStaticStringLiteral(node) && hasVisibleWord(node.value)) {
    context.report({ node, messageId: 'unclassified' });
    return;
  }
  if (node.type === 'TemplateLiteral' && containsStaticText(node)) {
    context.report({ node, messageId: 'interpolationRequired' });
    return;
  }
  if (
    node.type === 'BinaryExpression' &&
    node.operator === '+' &&
    containsStaticText(node)
  ) {
    context.report({ node, messageId: 'interpolationRequired' });
    return;
  }
  if (node.type === 'ConditionalExpression') {
    reportUserFacingExpression(context, node.consequent);
    reportUserFacingExpression(context, node.alternate);
  }
  if (node.type === 'LogicalExpression') {
    reportUserFacingExpression(context, node.left);
    reportUserFacingExpression(context, node.right);
  }
}

const noUnclassifiedUserFacingLiteral = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require user-facing literals to be classified with L() or NL().',
    },
    schema: [],
    messages: {
      interpolationRequired:
        'Use an L() key with i18next interpolation instead of composing user-facing text.',
      lKeyFormat:
        'L() requires a namespaced localization key such as common:action.cancel.',
      lStaticKeyOnly:
        'L() requires a static localization key as its first argument.',
      nlLiteralOnly: 'NL() accepts exactly one static string literal.',
      nlNonEmpty: 'NL() does not accept an empty or whitespace-only literal.',
      unclassified:
        'Classify this user-facing literal with L(), NL(), or a dynamic data expression.',
    },
  },
  create(context) {
    const filename = (context.filename ?? context.getFilename()).replaceAll(
      '\\',
      '/',
    );
    const presentationFormatterFile =
      !/(?:\/entities\/|\/domain\/|\/api\/|\/runtime\/|\/adapters\/|\/repository\/)/u.test(
        filename,
      );
    return {
      JSXText(node) {
        if (hasVisibleWord(node.value)) {
          context.report({ node, messageId: 'unclassified' });
        }
      },
      JSXAttribute(node) {
        if (!isUserFacingAttribute(node)) {
          return;
        }
        if (
          isStaticStringLiteral(node.value) &&
          hasVisibleWord(node.value.value)
        ) {
          context.report({ node: node.value, messageId: 'unclassified' });
          return;
        }
        if (node.value?.type === 'JSXExpressionContainer') {
          reportUserFacingExpression(context, node.value.expression);
        }
      },
      JSXExpressionContainer(node) {
        if (node.parent?.type !== 'JSXAttribute') {
          reportUserFacingExpression(context, node.expression);
        }
      },
      CallExpression(node) {
        if (node.callee.type === 'Identifier' && node.callee.name === 'L') {
          const key = getStaticStringValue(node.arguments[0]);
          if (key === null) {
            context.report({ node, messageId: 'lStaticKeyOnly' });
          } else if (!LOCALIZATION_KEY_PATTERN.test(key)) {
            context.report({
              node: node.arguments[0],
              messageId: 'lKeyFormat',
            });
          }
        }
        if (node.callee.type === 'Identifier' && node.callee.name === 'NL') {
          const literal = getStaticStringValue(node.arguments[0]);
          if (node.arguments.length !== 1 || literal === null) {
            context.report({ node, messageId: 'nlLiteralOnly' });
          } else if (!hasVisibleText(literal)) {
            context.report({
              node: node.arguments[0],
              messageId: 'nlNonEmpty',
            });
          }
        }
        if (USER_FACING_CALLS.has(getCalledName(node))) {
          reportUserFacingExpression(context, node.arguments[0]);
        }
      },
      ReturnStatement(node) {
        if (!presentationFormatterFile || !node.argument) {
          return;
        }
        const functionName = getEnclosingFunctionName(node);
        if (NON_USER_FACING_FORMATTERS.has(functionName)) {
          return;
        }
        if (
          !/^(?:format|describe|get.*(?:Label|Message|Title|Description|Text))/iu.test(
            functionName,
          )
        ) {
          return;
        }
        reportUserFacingExpression(context, node.argument);
      },
    };
  },
};

export const localizationPlugin = {
  rules: {
    'no-unclassified-user-facing-literal': noUnclassifiedUserFacingLiteral,
  },
};
