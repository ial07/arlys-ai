/**
 * User Token API - Get current user's token balance
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        tokens: true,
        email: true,
        name: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ tokens: user.tokens, email: user.email, name: user.name });
  } catch (error) {
    console.error('GET /api/user/tokens error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
