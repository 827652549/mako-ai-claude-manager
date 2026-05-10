import { NextResponse } from 'next/server';
import { readClaudeSettings, readClaudeLocalSettings } from '@/lib/claude-config';

export async function GET() {
  try {
    const [settings, localSettings] = await Promise.all([
      readClaudeSettings(),
      readClaudeLocalSettings(),
    ]);
    return NextResponse.json({ data: { settings, localSettings } });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          errorCode: 'error500',
          errorMsg: `Failed to read config: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      },
      { status: 500 },
    );
  }
}
