import { NextResponse } from 'next/server';
import { readAgents } from '@/lib/claude-config';

export async function GET() {
  try {
    const agents = await readAgents();
    return NextResponse.json({ data: agents });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          errorCode: 'error500',
          errorMsg: `Failed to read agents: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      },
      { status: 500 },
    );
  }
}
