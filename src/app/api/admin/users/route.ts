/**
 * Admin Users API - Manage users and tokens
 * Only accessible by Super Admin (ialilham77@gmail.com)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';

const SUPER_ADMIN_EMAIL = 'ialilham77@gmail.com';

// GET /api/admin/users - List all users
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email || session.user.email !== SUPER_ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        tokens: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('GET /api/admin/users error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PATCH /api/admin/users - Update user tokens
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email || session.user.email !== SUPER_ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId, tokens, action } = await request.json();

    if (!userId || tokens === undefined) {
      return NextResponse.json({ error: 'userId and tokens are required' }, { status: 400 });
    }

    let updatedUser;

    if (action === 'set') {
      // Set tokens to exact value
      updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { tokens: Math.max(0, tokens) },
      });
    } else {
      // Default: Add tokens
      updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { tokens: { increment: tokens } },
      });
    }

    return NextResponse.json({ 
      success: true, 
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        tokens: updatedUser.tokens,
      }
    });
  } catch (error) {
    console.error('PATCH /api/admin/users error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
