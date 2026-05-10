import { NextResponse } from 'next/server';
import { getDirectoryTree } from '@/lib/claude-config';

export async function GET() {
  try {
    const tree = await getDirectoryTree();
    return NextResponse.json({ data: tree });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          errorCode: 'error500',
          errorMsg: `Failed to read directory tree: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      },
      { status: 500 },
    );
  }
}
