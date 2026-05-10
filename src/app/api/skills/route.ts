import { NextResponse } from 'next/server';
import { readSkills } from '@/lib/claude-config';

export async function GET() {
  try {
    const skills = await readSkills();
    return NextResponse.json({ data: skills });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          errorCode: 'error500',
          errorMsg: `Failed to read skills: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      },
      { status: 500 },
    );
  }
}
