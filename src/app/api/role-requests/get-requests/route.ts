import { NextResponse } from 'next/server'
import { Filter } from 'mongodb'
import clientPromise from '@/lib/mongodb'

interface User {
  name?: string
  email?: string
}

const DB_NAME = process.env.DB_NAME || 'my-next-app'

export async function GET(req: Request) {
  try {
    const client = await clientPromise
    const db = client.db(DB_NAME)

    const usersCollection = db.collection('users')

    const url = new URL(req.url)
    const page = parseInt(url.searchParams.get('page') || '1', 10)
    const limit = parseInt(url.searchParams.get('limit') || '10', 10)
    const skip = (page - 1) * limit
    const searchQuery = url.searchParams.get('search') || ''

    // let filter: Filter<User> = { status: { $in: [0, 1, 2] } };
    let filter: Filter<User> = {
      status: { $in: [0, 1, 2] },
      $or: [
        { isDeleted: { $exists: false } }, // Users without the 'isDeleted' field
        { isDeleted: false }, // Users with 'isDeleted' field set to false
      ],
    }

    if (searchQuery) {
      const searchRegex = { $regex: searchQuery, $options: 'i' }
      filter = {
        ...filter,
        $or: [
          { name: searchRegex },
          { email: searchRegex },
          { role: searchRegex },
        ],
      }
    }

    const users = await usersCollection
      .find(filter)
      .skip(skip)
      .limit(limit)
      .toArray()
    const totalUsers = await usersCollection.countDocuments(filter)

    return NextResponse.json(
      { users, totalUsers, page, totalPages: Math.ceil(totalUsers / limit) },
      { status: 200 },
    )
  } catch (error) {
    console.log('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users.' },
      { status: 500 },
    )
  }
}

export async function OPTIONS() {
  return NextResponse.json({ allowedMethods: ['GET'] })
}
