#!/bin/bash
cd /home/kavia/workspace/code-generation/interactive-tic-tac-toe-303465-303474/frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

