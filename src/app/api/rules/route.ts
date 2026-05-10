import { NextResponse } from 'next/server';
import { readProjectRules } from '@/lib/claude-config';

export async function GET() {
  try {
    const rules = await readProjectRules();
    return NextResponse.json({ data: rules });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          errorCode: 'error500',
          errorMsg: `Failed to read rules: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      },
      { status: 500 },
    );
  }
}
